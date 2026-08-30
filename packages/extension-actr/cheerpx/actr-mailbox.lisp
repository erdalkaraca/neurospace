;;; File-mailbox RPC for Lisp-only ACT-R under CheerpX.
;;;
;;; Mounts (from JS):
;;;   /ipc-in  — DataDevice  (JS writes req.json + req.ready; Lisp reads)
;;;   /ipc-out — IDBDevice   (Lisp writes progress/ready/res.*; JS reads)
;;;
;;; Request body matches ACT-R remote JSON-RPC 1.0 (no EOT framing):
;;;   {"method":"evaluate","params":["act-r-version",false],"id":1}
;;;
;;; Response:
;;;   {"result":["7.31.4-…"],"error":null,"id":1}
;;;
;;; Note: single-threaded ACT-R replaces cl-json with identity macros, so this
;;; file ships a tiny JSON codec used only for the mailbox.

(defun mailbox-progress (msg)
  (ensure-directories-exist #P"/ipc-out/")
  (ignore-errors
    (with-open-file (out "/ipc-out/progress"
                         :direction :output
                         :if-exists :supersede
                         :if-does-not-exist :create)
      (write-string msg out)
      (finish-output out)))
  (format t "~%[mailbox] ~a~%" msg)
  (finish-output))

(mailbox-progress "ecl-bytecodes")
(ext:install-bytecodes-compiler)

(mailbox-progress "loading-act-r")
(load "/opt/actr/actr7.x/load-single-threaded-act-r.lisp")
(mailbox-progress "act-r-loaded")

(defpackage :actr-mailbox
  (:use :cl)
  (:export #:serve))

(in-package :actr-mailbox)

(defparameter *in-dir* "/ipc-in/")
(defparameter *out-dir* "/ipc-out/")
(defparameter *poll-seconds* 0.05)
(defparameter *next-req-id* 1)

;;;; Minimal JSON (mailbox protocol only)

(defun json-skip-ws (s i)
  (loop while (and (< i (length s))
                   (member (char s i) '(#\Space #\Tab #\Newline #\Return)))
        do (incf i))
  i)

(defun json-parse-string (s i)
  (unless (char= (char s i) #\")
    (error "JSON string expected at ~d" i))
  (incf i)
  (let ((chars nil))
    (loop
      (when (>= i (length s))
        (error "unterminated JSON string"))
      (let ((c (char s i)))
        (cond
          ((char= c #\")
           (return (values (coerce (nreverse chars) 'string) (1+ i))))
          ((char= c #\\)
           (incf i)
           (when (>= i (length s))
             (error "bad JSON escape"))
           (let ((e (char s i)))
             (push
              (case e
                (#\" #\")
                (#\\ #\\)
                (#\/ #\/)
                (#\b #\Backspace)
                (#\f #\Page)
                (#\n #\Newline)
                (#\r #\Return)
                (#\t #\Tab)
                (t e))
              chars)
             (incf i)))
          (t
           (push c chars)
           (incf i)))))))

(defun json-parse-number (s i)
  (let ((start i))
    (when (and (< i (length s)) (char= (char s i) #\-))
      (incf i))
    (loop while (and (< i (length s)) (digit-char-p (char s i)))
          do (incf i))
    (when (and (< i (length s)) (char= (char s i) #\.))
      (incf i)
      (loop while (and (< i (length s)) (digit-char-p (char s i)))
            do (incf i)))
    (values (read-from-string (subseq s start i)) i)))

(defun json-parse-value (s i)
  (setf i (json-skip-ws s i))
  (when (>= i (length s))
    (error "unexpected end of JSON"))
  (let ((c (char s i)))
    (cond
      ((char= c #\")
       (json-parse-string s i))
      ((char= c #\{)
       (json-parse-object s i))
      ((char= c #\[)
       (json-parse-array s i))
      ((and (< (+ i 4) (length s)) (string= s "true" :start1 i :end1 (+ i 4)))
       (values t (+ i 4)))
      ((and (< (+ i 5) (length s)) (string= s "false" :start1 i :end1 (+ i 5)))
       (values nil (+ i 5)))
      ((and (< (+ i 4) (length s)) (string= s "null" :start1 i :end1 (+ i 4)))
       (values nil (+ i 4)))
      ((or (char= c #\-) (digit-char-p c))
       (json-parse-number s i))
      (t
       (error "unexpected JSON at ~d: ~a" i c)))))

(defun json-parse-array (s i)
  (unless (char= (char s i) #\[)
    (error "JSON array expected"))
  (incf i)
  (setf i (json-skip-ws s i))
  (when (and (< i (length s)) (char= (char s i) #\]))
    (return-from json-parse-array (values nil (1+ i))))
  (let ((items nil))
    (loop
      (multiple-value-bind (v ni) (json-parse-value s i)
        (push v items)
        (setf i (json-skip-ws s ni)))
      (cond
        ((char= (char s i) #\])
         (return (values (nreverse items) (1+ i))))
        ((char= (char s i) #\,)
         (incf i))
        (t
         (error "bad JSON array at ~d" i))))))

(defun json-parse-object (s i)
  (unless (char= (char s i) #\{)
    (error "JSON object expected"))
  (incf i)
  (setf i (json-skip-ws s i))
  (when (and (< i (length s)) (char= (char s i) #\}))
    (return-from json-parse-object (values nil (1+ i))))
  (let ((alist nil))
    (loop
      (multiple-value-bind (key ni) (json-parse-string s i)
        (setf i (json-skip-ws s ni))
        (unless (char= (char s i) #\:)
          (error "JSON object expected ':'"))
        (incf i)
        (multiple-value-bind (val nj) (json-parse-value s i)
          (push (cons (intern (string-upcase key) :keyword) val) alist)
          (setf i (json-skip-ws s nj))))
      (cond
        ((char= (char s i) #\})
         (return (values (nreverse alist) (1+ i))))
        ((char= (char s i) #\,)
         (incf i)
         (setf i (json-skip-ws s i)))
        (t
         (error "bad JSON object at ~d" i))))))

(defun json-decode (string)
  (multiple-value-bind (value i) (json-parse-value string 0)
    (setf i (json-skip-ws string i))
    (unless (= i (length string))
      (error "trailing JSON junk at ~d" i))
    value))

(defun json-escape (string)
  (with-output-to-string (out)
    (loop for c across string do
      (case c
        (#\" (write-string "\\\"" out))
        (#\\ (write-string "\\\\" out))
        (#\Newline (write-string "\\n" out))
        (#\Return (write-string "\\r" out))
        (#\Tab (write-string "\\t" out))
        (t (write-char c out))))))

(defun json-encode-value (value out)
  (cond
    ((null value)
     (write-string "null" out))
    ((eq value t)
     (write-string "true" out))
    ((stringp value)
     (write-char #\" out)
     (write-string (json-escape value) out)
     (write-char #\" out))
    ((numberp value)
     (princ value out))
    ((and (consp value) (keywordp (car value)))
     ;; improper use — treat as singleton alist entry list elsewhere
     (error "unexpected cons ~s" value))
    ((listp value)
     (if (and value (consp (first value)) (keywordp (car (first value))))
         (json-encode-object value out)
         (json-encode-array value out)))
    (t
     (error "cannot encode ~s" value))))

(defun json-encode-array (items out)
  (write-char #\[ out)
  (loop for rest on items
        for item = (car rest)
        do (json-encode-value item out)
           (when (cdr rest) (write-char #\, out)))
  (write-char #\] out))

(defun json-encode-object (alist out)
  (write-char #\{ out)
  (loop for rest on alist
        for (key . val) = (car rest)
        do (write-char #\" out)
           (write-string (string-downcase (symbol-name key)) out)
           (write-string "\":" out)
           (json-encode-value val out)
           (when (cdr rest) (write-char #\, out)))
  (write-char #\} out))

(defun json-encode (object)
  (with-output-to-string (out)
    (json-encode-value object out)))

;;;; Filesystem helpers

(defun path (dir name)
  (concatenate 'string dir name))

(defun trim (s)
  (string-trim '(#\Space #\Tab #\Newline #\Return) s))

(defun read-text (pathname)
  (with-open-file (in pathname :direction :input :if-does-not-exist nil)
    (unless in
      (return-from read-text nil))
    (let* ((len (file-length in))
           (buf (make-string len)))
      (read-sequence buf in)
      buf)))

(defun write-text (pathname text)
  (ensure-directories-exist pathname)
  (with-open-file (out pathname
                       :direction :output
                       :if-exists :supersede
                       :if-does-not-exist :create)
    (write-string text out)
    (finish-output out)))

(defun assoc-val (key alist)
  (cdr (assoc key alist :test #'string-equal)))

;;;; RPC

(defun rpc-error (id message)
  `((:result . nil)
    (:error . ((:message . ,message)))
    (:id . ,id)))

(defun rpc-ok (id values)
  `((:result . ,(coerce values 'list))
    (:error . nil)
    (:id . ,id)))

(defun condition-string (err)
  (with-output-to-string (out)
    (format out "~a" err)))

(defun handle-evaluate (params id)
  (unless (and (consp params) (stringp (first params)))
    (return-from handle-evaluate
      (rpc-error id "evaluate requires params [command, model, ...args]")))
  (let* ((name (first params))
         (args (cddr params))
         (*package* (find-package :cl-user))
         (result (multiple-value-list
                  (handler-case
                      (apply #'cl-user::evaluate-act-r-command name args)
                    (error (e)
                      (return-from handle-evaluate
                        (rpc-error id (condition-string e))))))))
    (if (first result)
        (rpc-ok id (rest result))
        (rpc-error id (or (second result) "evaluate failed")))))

;;;; Guest file staging (avoid large DataDevice.writeFile — CheerpX rejects those)

(defparameter *write-path* nil)
(defparameter *write-parts* nil)

(defun handle-write-begin (params id)
  (let ((pathname (first params)))
    (unless (stringp pathname)
      (return-from handle-write-begin
        (rpc-error id "write-begin requires pathname string")))
    (ensure-directories-exist pathname)
    (ignore-errors (delete-file pathname))
    (setf *write-path* pathname
          *write-parts* nil)
    (rpc-ok id (list pathname))))

(defun handle-write-chunk (params id)
  (unless *write-path*
    (return-from handle-write-chunk
      (rpc-error id "write-chunk without write-begin")))
  (let ((chunk (first params)))
    (unless (stringp chunk)
      (return-from handle-write-chunk
        (rpc-error id "write-chunk requires string")))
    (push chunk *write-parts*)
    (rpc-ok id (list (length chunk)))))

(defun handle-write-end (params id)
  (declare (ignore params))
  (unless *write-path*
    (return-from handle-write-end
      (rpc-error id "write-end without write-begin")))
  (let ((pathname *write-path*)
        (text (apply #'concatenate 'string (nreverse *write-parts*))))
    (setf *write-path* nil
          *write-parts* nil)
    (write-text pathname text)
    (rpc-ok id (list pathname (length text)))))

;;; Load model with *package* bound to CL-USER (mailbox package would break define-model).
(defun handle-load-model (params id)
  (let ((pathname (first params)))
    (unless (stringp pathname)
      (return-from handle-load-model
        (rpc-error id "load-model requires pathname string")))
    (unless (probe-file pathname)
      (return-from handle-load-model
        (rpc-error id (format nil "file does not exist: ~a" pathname))))
    ;; Clear a stuck top-level user from a prior failed load (single-threaded).
    (ignore-errors (setf cl-user::*top-level-user* nil))
    (handler-case
        (let ((*package* (find-package :cl-user)))
          (cl-user::internal-load-act-r-model pathname nil)
          (rpc-ok id (list pathname t)))
      (error (e)
        (rpc-error id (condition-string e))))))

(defun handle-request (message)
  (let* ((method (assoc-val :method message))
         (params (assoc-val :params message))
         (id (assoc-val :id message)))
    (cond
      ((null method)
       (rpc-error id "missing method"))
      ((string-equal method "evaluate")
       (handle-evaluate params id))
      ((string-equal method "write-begin")
       (handle-write-begin params id))
      ((string-equal method "write-chunk")
       (handle-write-chunk params id))
      ((string-equal method "write-end")
       (handle-write-end params id))
      ((string-equal method "load-model")
       (handle-load-model params id))
      (t
       (rpc-error id
                  (format nil "unsupported method ~s"
                          method))))))

(defun clear-response ()
  (ignore-errors (delete-file (path *out-dir* "res.ready")))
  (ignore-errors (delete-file (path *out-dir* "res.json"))))

(defun write-response (object)
  (clear-response)
  (write-text (path *out-dir* "res.json") (json-encode object))
  (write-text (path *out-dir* "res.ready")
              (princ-to-string (or (assoc-val :id object) ""))))

(defun process-once ()
  (let* ((token (princ-to-string *next-req-id*))
         (ready-path (path *in-dir* (concatenate 'string "r" token ".ready")))
         (json-path (path *in-dir* (concatenate 'string "r" token ".json"))))
    (unless (probe-file ready-path)
      (return-from process-once nil))
    (let* ((body (read-text json-path))
           (message (handler-case (json-decode body)
                      (error (e)
                        (write-response
                         (rpc-error *next-req-id*
                                    (format nil "invalid JSON: ~a" e)))
                        (incf *next-req-id*)
                        (return-from process-once t)))))
      (format t "~%mailbox: ~a id=~a~%"
              (assoc-val :method message)
              (assoc-val :id message))
      (finish-output)
      (write-response (handle-request message))
      (incf *next-req-id*)
      t)))

(defun announce-ready ()
  (write-text (path *out-dir* "progress") "ready")
  (write-text (path *out-dir* "ready")
              (cl-user::act-r-version-string))
  (format t "~%ACT-R mailbox ready on /ipc-in / /ipc-out (evaluate only)~%")
  (format t "ACT-R ~a~%" (cl-user::act-r-version-string))
  (finish-output))

(defun serve (&key (announce t))
  (ensure-directories-exist *out-dir*)
  (clear-response)
  (when announce
    (announce-ready))
  (loop
    (handler-case (process-once)
      (error (e)
        (format t "mailbox poll error: ~a~%" e)
        (finish-output)))
    (sleep *poll-seconds*)))

(serve)
