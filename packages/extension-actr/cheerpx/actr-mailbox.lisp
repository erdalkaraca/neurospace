;;; File-mailbox RPC for Lisp-only ACT-R under CheerpX.
;;;
;;; Mounts (from JS):
;;;   /ipc-in  — DataDevice  (JS writes req.json + req.ready; Lisp reads)
;;;   /ipc-out — IDBDevice   (Lisp writes progress/ready/res.*; JS reads)
;;;
;;; Multiple processes share the mounts; set ACTR_SLOT (default "main") so all
;;; ipc filenames are prefixed: /ipc-out/{slot}.ready, /ipc-in/{slot}.r1.json, …
;;;
;;; Request body matches ACT-R remote JSON-RPC 1.0 (no EOT framing):
;;;   {"method":"evaluate","params":["act-r-version",false],"id":1}
;;;
;;; Response:
;;;   {"result":["7.31.4-…"],"error":null,"id":1}
;;;
;;; Note: single-threaded ACT-R replaces cl-json with identity macros, so this
;;; file ships a tiny JSON codec used only for the mailbox.

(defparameter *actr-slot*
  (let ((s (ignore-errors (ext:getenv "ACTR_SLOT"))))
    (if (and s (stringp s) (plusp (length s))) s "main")))

(defun slot-out (name)
  (concatenate 'string "/ipc-out/" *actr-slot* "." name))

(defun slot-in (name)
  (concatenate 'string "/ipc-in/" *actr-slot* "." name))

(defparameter *console-stream* nil)

(defun init-console-mirror ()
  (ensure-directories-exist #P"/ipc-out/")
  (handler-case
      (progn
        (setf *console-stream*
              (open (slot-out "console")
                    :direction :output
                    :if-exists :supersede
                    :if-does-not-exist :create))
        (setf *standard-output*
              (make-broadcast-stream *standard-output* *console-stream*))
        (setf *error-output* *standard-output*)
        (finish-output *console-stream*))
    (error (e)
      (format t "console mirror unavailable: ~a~%" e)
      (finish-output))))

(defun mailbox-progress (msg)
  (ensure-directories-exist #P"/ipc-out/")
  (ignore-errors
    (with-open-file (out (slot-out "progress")
                         :direction :output
                         :if-exists :supersede
                         :if-does-not-exist :create)
      (write-string msg out)
      (finish-output out)))
  (format t "~%[mailbox ~a] ~a~%" *actr-slot* msg)
  (finish-output)
  (ignore-errors (finish-output *console-stream*)))

(init-console-mirror)
(mailbox-progress "ecl-bytecodes")
(ext:install-bytecodes-compiler)

(mailbox-progress "loading-act-r")
(load "/opt/actr/actr7.x/load-single-threaded-act-r.lisp")
(mailbox-progress "act-r-loaded")

(defpackage :actr-mailbox
  (:use :cl)
  (:export #:serve))

(in-package :actr-mailbox)

(defparameter *poll-seconds* 0.05)
(defparameter *next-req-id* 1)
(defparameter *slot* cl-user::*actr-slot*)
(defparameter *client-commands* (make-hash-table :test #'equalp))
(defparameter *pending-callbacks* nil)
(defparameter *command-monitors* nil)
(defparameter *pending-windows* nil)

(defun out-path (name)
  (cl-user::slot-out name))

(defun in-path (name)
  (cl-user::slot-in name))

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
    ((eq value :json-false)
     (write-string "false" out))
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
    (ignore-errors (finish-output cl-user::*console-stream*))
    (if (first result)
        (rpc-ok id (rest result))
        (rpc-error id (or (second result) "evaluate failed")))))

(defun handle-quit (params id)
  (declare (ignore params))
  (let ((response (rpc-ok id (list t))))
    (write-response response)
    (ignore-errors (finish-output cl-user::*console-stream*))
    (ignore-errors (close cl-user::*console-stream*))
    (ignore-errors (si:exit 0))
    (ignore-errors (ext:quit 0))
    response))

;;;; Guest file staging via write-* RPC is unused; JS stages models with
;;;; DataDevice.writeFile onto /ipc-in and load-model reads that path.

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
          (ignore-errors (finish-output cl-user::*console-stream*))
          (rpc-ok id (list pathname t)))
      (error (e)
        (rpc-error id (condition-string e))))))

(defun console-text ()
  (ignore-errors (finish-output cl-user::*console-stream*))
  (or (read-text (out-path "console")) ""))

(defun console-delta (before after)
  (if (and (>= (length after) (length before))
           (string= before (subseq after 0 (length before))))
      (subseq after (length before))
      after))

(defun split-lines (text)
  (let ((start 0)
        (lines nil)
        (len (length text)))
    (loop for i from 0 below len
          when (char= (char text i) #\Newline)
            do (push (subseq text start i) lines)
               (setf start (1+ i)))
    (when (< start len)
      (push (subseq text start) lines))
    (nreverse lines)))

(defun skip-space (line i)
  (loop while (and (< i (length line))
                   (member (char line i) '(#\Space #\Tab #\Return)))
        do (incf i))
  i)

(defun parse-event-line (line)
  (let ((len (length line))
        (i (skip-space line 0)))
    (when (or (>= i len)
              (not (or (digit-char-p (char line i)) (char= (char line i) #\-))))
      (return-from parse-event-line nil))
    (let ((start i))
      (when (char= (char line i) #\-) (incf i))
      (loop while (and (< i len) (digit-char-p (char line i))) do (incf i))
      (when (and (< i len) (char= (char line i) #\.))
        (incf i)
        (loop while (and (< i len) (digit-char-p (char line i))) do (incf i)))
      (when (= i start)
        (return-from parse-event-line nil))
      (let ((time (read-from-string (subseq line start i))))
        (setf i (skip-space line i))
        (let ((mstart i))
          (loop while (and (< i len)
                           (not (member (char line i) '(#\Space #\Tab))))
                do (incf i))
          (when (= i mstart)
            (return-from parse-event-line nil))
          (let ((module (subseq line mstart i)))
            (when (or (search "Stopped because" line)
                      (every (lambda (c) (char= c #\-)) module))
              (return-from parse-event-line nil))
            (setf i (skip-space line i))
            (list time
                  (string-downcase module)
                  (string-trim '(#\Space #\Tab #\Return) (subseq line i)))))))))

(defun last-trace-event (text)
  (let ((found nil))
    (dolist (line (split-lines text) found)
      (let ((event (parse-event-line line)))
        (when event (setf found event))))))

(defun actr-command (name &rest args)
  (let ((*package* (find-package :cl-user)))
    (multiple-value-list
     (apply #'cl-user::evaluate-act-r-command name args))))

(defun actr-ok (values)
  (unless (first values)
    (error "~a" (or (second values) "ACT-R command failed")))
  (rest values))

(defun command-value (name &rest args)
  (first (actr-ok (apply #'actr-command name args))))

(defun json-slot-value (value)
  (cond ((null value) nil)
        ((stringp value) value)
        ((numberp value) value)
        ((symbolp value) (string-downcase (symbol-name value)))
        (t (string-downcase (princ-to-string value)))))

(defun keyword-name (symbol)
  (intern (string-upcase (symbol-name symbol)) :keyword))

(defun snapshot-chunk (chunk)
  (let ((slots (command-value "chunk-filled-slots-list" chunk))
        (pairs nil))
    (when (symbolp slots)
      (setf slots (list slots)))
    (unless (listp slots)
      (setf slots nil))
    (dolist (slot slots)
      (let ((value (json-slot-value (command-value "chunk-slot-value" chunk slot))))
        (when value
          (push (cons (keyword-name slot) value) pairs))))
    (nreverse pairs)))

(defun snapshot-buffers ()
  (let ((names (command-value "buffers"))
        (pairs nil))
    (when (symbolp names)
      (setf names (list names)))
    (unless (listp names)
      (setf names nil))
    (dolist (name names)
      (when (symbolp name)
        (let ((chunk (command-value "buffer-read" name)))
          (push (cons (keyword-name name)
                      (if chunk (snapshot-chunk chunk) nil))
                pairs))))
    (nreverse pairs)))

(defun debug-step-snapshot ()
  (let* ((before (console-text))
         (run (actr-ok (actr-command "run-n-events" 1)))
         (time-passed (first run))
         (event-count (second run)))
    (ignore-errors (finish-output cl-user::*console-stream*))
    (let* ((event (last-trace-event (console-delta before (console-text))))
           (done (or (and (numberp event-count) (zerop event-count))
                     (and (null event-count) (null event)))))
      `((:time . ,(cond ((numberp time-passed) time-passed)
                        (event (first event))
                        (t nil)))
        (:module . ,(and event (second event)))
        (:details . ,(and event (third event)))
        (:done . ,(if done t :json-false))
        (:buffers . ,(snapshot-buffers))))))

(defun handle-debug-step (params id)
  (declare (ignore params))
  (handler-case
      (let ((*package* (find-package :cl-user)))
        (ignore-errors (finish-output cl-user::*console-stream*))
        (rpc-ok id (list (debug-step-snapshot))))
    (error (e)
      (rpc-error id (condition-string e)))))

(defun callback-value (value)
  (cond ((null value) nil)
        ((eq value t) t)
        ((stringp value) value)
        ((characterp value) (string value))
        ((numberp value) value)
        ((symbolp value) (string-downcase (symbol-name value)))
        ((listp value) (mapcar #'callback-value value))
        (t (princ-to-string value))))

(defun command-name (params)
  (let ((name (first params)))
    (when (and (stringp name) (plusp (length name)))
      name)))

(defun handle-check (params id)
  (let ((name (command-name params)))
    (unless name
      (return-from handle-check (rpc-error id "Invalid command name")))
    (if (gethash name *client-commands*)
        (rpc-ok id (list name "python"))
        (rpc-ok id (list nil nil)))))

(defun handle-add (params id)
  (let ((name (command-name params))
        (call-name (second params))
        (documentation (third params)))
    (unless name
      (return-from handle-add (rpc-error id "Invalid command name")))
    (handler-case
        (let ((hook (if (stringp call-name) call-name name)))
          (cl-user::add-act-r-command
           name
           (lambda (&rest args)
             (push (list hook (mapcar #'callback-value args)) *pending-callbacks*)
             t)
           (if (stringp documentation)
               documentation
               "No documentation provided."))
          (setf (gethash name *client-commands*) t)
          (rpc-ok id (list t)))
      (error (e)
        (rpc-error id (condition-string e))))))

(defun remember-monitor (watched watcher)
  (when (and (stringp watched) (stringp watcher))
    (push (cons watched watcher) *command-monitors*)))

(defun forget-monitor (watched watcher)
  (setf *command-monitors*
        (remove-if (lambda (pair)
                     (and (or (null watched) (string-equal (car pair) watched))
                          (or (null watcher) (string-equal (cdr pair) watcher))))
                   *command-monitors*)))

(defun handle-monitor (params id)
  (handler-case
      (progn
        (cl-user::monitor-act-r-command (first params) (second params))
        (remember-monitor (first params) (second params))
        (rpc-ok id (list t)))
    (error (e)
      (rpc-error id (condition-string e)))))

(defun handle-remove-monitor (params id)
  (handler-case
      (progn
        (cl-user::remove-act-r-command-monitor (first params) (second params))
        (forget-monitor (first params) (second params))
        (rpc-ok id (list t)))
    (error (e)
      (rpc-error id (condition-string e)))))

(defun deliver-human-key (key)
  (let ((before *pending-callbacks*))
    (ignore-errors (actr-command "output-key" nil key))
    (when (eq before *pending-callbacks*)
      (dolist (pair *command-monitors*)
        (when (string-equal (car pair) "output-key")
          (push (list (cdr pair) (list nil key)) *pending-callbacks*))))))

(defun handle-human-keys (params id)
  (handler-case
      (dolist (key params)
        (unless (stringp key)
          (error "Invalid key"))
        (deliver-human-key key))
    (error (e)
      (return-from handle-human-keys (rpc-error id (condition-string e)))))
  (ignore-errors (cl-user::process-events))
  (rpc-ok id (list nil)))

(defun handle-remove (params id)
  (let ((name (command-name params)))
    (unless name
      (return-from handle-remove (rpc-error id "Invalid command name")))
    (handler-case
        (progn
          (cl-user::remove-act-r-command name)
          (remhash name *client-commands*)
          (forget-monitor nil name)
          (rpc-ok id (list t)))
      (error (e)
        (rpc-error id (condition-string e))))))

(defun neurospace-window-handler (message)
  (when (listp message)
    (push (callback-value message) *pending-windows*))
  t)

(defun install-exp-window-handler ()
  (handler-case
      (progn
        (cl-user::add-act-r-command
         "neurospace-window"
         #'neurospace-window-handler
         "Neurospace visible experiment window")
        (cl-user::add-virtual-window-handler "neurospace-window" t)
        (format t "~%ACT-R mailbox[~a] experiment window handler installed~%" *slot*))
    (error (e)
      (format t "~%ACT-R mailbox[~a] window handler unavailable: ~a~%" *slot* e)))
  (finish-output))

(defun attach-callbacks (response)
  (let ((callbacks (nreverse *pending-callbacks*))
        (windows (nreverse *pending-windows*)))
    (setf *pending-callbacks* nil
          *pending-windows* nil)
    (when callbacks
      (setf response (acons :callbacks callbacks response)))
    (when windows
      (setf response (acons :windows windows response)))
    response))

(defun handle-request (message)
  (let* ((method (assoc-val :method message))
         (params (assoc-val :params message))
         (id (assoc-val :id message)))
    (cond
      ((null method)
       (rpc-error id "missing method"))
      ((string-equal method "evaluate")
       (handle-evaluate params id))
      ((string-equal method "load-model")
       (handle-load-model params id))
      ((string-equal method "debug-step")
       (handle-debug-step params id))
      ((string-equal method "quit")
       (handle-quit params id))
      ((string-equal method "check")
       (handle-check params id))
      ((string-equal method "add")
       (handle-add params id))
      ((string-equal method "monitor")
       (handle-monitor params id))
      ((string-equal method "remove-monitor")
       (handle-remove-monitor params id))
      ((string-equal method "remove")
       (handle-remove params id))
      ((string-equal method "human-keys")
       (handle-human-keys params id))
      (t
       (rpc-error id
                  (format nil "unsupported method ~s"
                          method))))))

(defun clear-response ()
  (ignore-errors (delete-file (out-path "res.ready")))
  (ignore-errors (delete-file (out-path "res.json"))))

(defun write-response (object)
  (clear-response)
  (write-text (out-path "res.json") (json-encode object))
  (write-text (out-path "res.ready")
              (princ-to-string (or (assoc-val :id object) ""))))

(defun process-once ()
  (let* ((token (princ-to-string *next-req-id*))
         (ready-path (in-path (concatenate 'string "r" token ".ready")))
         (json-path (in-path (concatenate 'string "r" token ".json"))))
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
      (format t "~%mailbox[~a]: ~a id=~a~%"
              *slot*
              (assoc-val :method message)
              (assoc-val :id message))
      (finish-output)
      (ignore-errors (finish-output cl-user::*console-stream*))
      (write-response (attach-callbacks (handle-request message)))
      (incf *next-req-id*)
      t)))

(defun announce-ready ()
  (install-exp-window-handler)
  (write-text (out-path "progress") "ready")
  (write-text (out-path "ready")
              (cl-user::act-r-version-string))
  (format t "~%ACT-R mailbox[~a] ready (evaluate + quit)~%" *slot*)
  (format t "ACT-R ~a~%" (cl-user::act-r-version-string))
  (finish-output)
  (ignore-errors (finish-output cl-user::*console-stream*)))

(defun serve (&key (announce t))
  (ensure-directories-exist #P"/ipc-out/")
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
