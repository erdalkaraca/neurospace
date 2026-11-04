"""Tutorial ACT-R client for the calls the unit notebooks and task scripts make.

The host installs a dispatcher with set_dispatcher. It receives the remote
method and its parameter list, and returns the JSON-RPC result list. Importing
this module does not open a connection.
"""

_send = None
_model = False
_commands = {}

_MISSING = "Could not start ACT-R connection."


def set_dispatcher(send):
    global _send
    _send = send


def handle_command(name, model, params):
    command = _commands.get(name)
    if command is None:
        raise KeyError(name)

    global _model
    previous = _model
    _model = model
    try:
        if params is None:
            return command()
        return command(*params)
    finally:
        _model = previous


def _normalize(value):
    """Pyodide 0.29 maps JavaScript null to jsnull, which is not None."""
    if value is None or type(value).__name__ == "JsNull":
        return None
    if isinstance(value, list):
        return [_normalize(item) for item in value]
    if isinstance(value, dict):
        return {key: _normalize(item) for key, item in value.items()}
    return value


def _apply_callbacks(callbacks):
    for item in callbacks or []:
        if not item:
            continue
        name = item[0]
        args = list(item[1]) if len(item) > 1 and item[1] is not None else []
        model = args[0] if args else None
        try:
            handle_command(name, model, args)
        except Exception as exc:
            print(exc)


def _command_result(result):
    """A host reply is either the result list or {result, callbacks}."""
    result = _normalize(result)
    if isinstance(result, dict) and "result" in result:
        _apply_callbacks(result.get("callbacks"))
        value = result.get("result")
        return [] if value is None else value
    return result


def _rpc(method, *params):
    if _send is None:
        return [False, _MISSING]
    try:
        result = _normalize(_command_result(_send(method, list(params))))
    except Exception as exc:
        return [False, str(exc)]
    if result is None:
        return [True]
    if isinstance(result, list):
        return [True, *result]
    return [True, result]


def _report(response):
    for item in response[1:]:
        print(item)
    return False


def _evaluate(command, *params):
    response = _rpc("evaluate", command, _model, *params)
    if response[0]:
        return response[1:]
    print("Error evaluating", command, ": ", end="")
    return _report(response)


def _single(command, *params):
    result = _evaluate(command, *params)
    if not result:
        return False
    return result[0]


def _options(values):
    return [[key, value] for key, value in values]


def reset():
    return _single("reset")


def reload(compile=False):
    return _single("reload", compile)


def run(time, real_time=False):
    return _evaluate("run", time, real_time)


def run_full_time(time, real_time=False):
    return _evaluate("run-full-time", time, real_time)


def buffer_chunk(*params):
    return _single("buffer-chunk", *params)


def whynot(*params):
    return _single("whynot", *params)


def whynot_dm(*params):
    return _single("whynot-dm", *params)


def pdisable(*params):
    return _single("pdisable", *params)


def load_act_r_model(path):
    return _single("load-act-r-model", path)


def goal_focus(goal=None):
    return _single("goal-focus", goal)


def clear_exp_window(win=None):
    return _single("clear-exp-window", win)


def open_exp_window(title, visible=True, width=300, height=300, x=300, y=300):
    return _single(
        "open-exp-window",
        title,
        _options((
            ("visible", visible),
            ("width", width),
            ("height", height),
            ("x", x),
            ("y", y),
        )),
    )


def add_text_to_exp_window(window, text, x=0, y=0, color="black", height=20, width=75, font_size=12):
    return _single(
        "add-text-to-exp-window",
        window,
        text,
        _options((
            ("color", color),
            ("width", width),
            ("height", height),
            ("x", x),
            ("y", y),
            ("font-size", font_size),
        )),
    )


def add_button_to_exp_window(window, text="", x=0, y=0, action=None, height=20, width=75, color="gray"):
    return _single(
        "add-button-to-exp-window",
        window,
        _options((
            ("color", color),
            ("width", width),
            ("height", height),
            ("x", x),
            ("y", y),
            ("text", text),
            ("action", action),
        )),
    )


def remove_items_from_exp_window(window, *items):
    return _single("remove-items-from-exp-window", window, *items)


def add_line_to_exp_window(window, start, end, color=False):
    if color:
        return _single("add-line-to-exp-window", window, start, end, color)
    return _single("add-line-to-exp-window", window, start, end)


def modify_line_for_exp_window(line, start, end, color=False):
    if color:
        return _single("modify-line-for-exp-window", line, start, end, color)
    return _single("modify-line-for-exp-window", line, start, end)


def install_device(device):
    return _single("install-device", device)


def print_warning(warning):
    _evaluate("print-warning", warning)


def random(value):
    return _single("act-r-random", value)


def get_time(model_time=True):
    return _single("get-time", model_time)


def mean_deviation(results, data, output=True):
    return _single("mean-deviation", results, data, output)


def correlation(results, data, output=True):
    return _single("correlation", results, data, output)


def buffer_read(buffer):
    return _single("buffer-read", buffer)


def buffer_slot_value(buffer_name, slot_name):
    return _single("buffer-slot-value", buffer_name, slot_name)


def clear_buffer(buffer):
    return _single("clear-buffer", buffer)


def new_tone_sound(freq, duration, onset=False, time_in_ms=False):
    return _single("new-tone-sound", freq, duration, onset, time_in_ms)


def new_digit_sound(digit, onset=False, time_in_ms=False):
    return _single("new-digit-sound", digit, onset, time_in_ms)


def define_chunks(*chunks):
    return _single("define-chunks", *chunks)


def add_dm(*chunks):
    return _single("add-dm", *chunks)


def chunk_slot_value(chunk_name, slot_name):
    return _single("chunk-slot-value", chunk_name, slot_name)


def chunk_p(chunk_name):
    return _single("chunk-p", chunk_name)


def copy_chunk(chunk_name):
    return _single("copy-chunk", chunk_name)


def mod_chunk(chunk_name, *mods):
    return _single("mod-chunk", chunk_name, *mods)


def mod_focus(*mods):
    return _single("mod-focus", *mods)


def extend_possible_slots(slot_name, warn=True):
    return _single("extend-possible-slots", slot_name, warn)


def model_output(output_string):
    return _single("model-output", output_string)


def set_buffer_chunk(buffer_name, chunk_name, requested=True):
    return _single("set-buffer-chunk", buffer_name, chunk_name, requested)


def start_hand_at_mouse():
    return _single("start-hand-at-mouse")


def schedule_event_relative(
    time_delay,
    action,
    params=None,
    module=":NONE",
    priority=0,
    maintenance=False,
    destination=None,
    details=None,
    output=True,
    time_in_ms=False,
    precondition=None,
):
    return _single(
        "schedule-event-relative",
        time_delay,
        action,
        _options((
            ("params", params),
            ("module", module),
            ("priority", priority),
            ("maintenance", maintenance),
            ("destination", destination),
            ("details", details),
            ("output", output),
            ("time-in-ms", time_in_ms),
            ("precondition", precondition),
        )),
    )


def mp_show_queue(indicate_traced=False):
    return _single("mp-show-queue", indicate_traced)


def print_dm_finsts():
    return _single("print-dm-finsts")


def record_history(*params):
    return _single("record-history", *params)


def get_history_data(history, *params):
    return _single("get-history-data", history, *params)


def saved_activation_history():
    return _single("saved-activation-history")


def print_activation_trace(time, ms=True):
    return _single("print-activation-trace", time, ms)


def print_chunk_activation_trace(chunk, time, ms=True):
    return _single("print-chunk-activation-trace", chunk, time, ms)


def sdm(*params):
    return _single("sdm", *params)


def sdp(*params):
    return _single("sdp", *params)


def set_parameter_value(param, value):
    return _single("set-parameter-value", param, value)


def simulate_retrieval_request(*spec):
    return _single("simulate-retrieval-request", *spec)


def visible_virtuals_available():
    return _single("visible-virtuals-available?")


def no_output(command, *params):
    return _single("no-output", command, *params)


def process_events():
    """Let a person act on the experiment window, then return any key that arrived."""
    _single("process-events")


def permute_list(items):
    indexes = list(range(len(items)))
    order = _single("permute-list", indexes)
    return [items[index] for index in order]


def add_command(name, function=None, documentation="No documentation provided.", single=True, local_name=None, encoded=False):
    if name in _commands and _commands[name] != function:
        print("Command ", name, " already exists and is now being replaced by ", function)
    elif name in _commands:
        print("Command ", name, " already exists for function ", function)

    call_name = name if function else None
    existing = _rpc("check", name)
    if not existing[0]:
        print("Invalid command name ", name, " cannot be added.")
        return False
    if len(existing) > 1 and existing[1] is None:
        result = _rpc("add", name, call_name, documentation, single, local_name, encoded)
        if not result[0]:
            return _report(result)
        _commands[name] = function
        return result[1] if len(result) > 1 else True
    if len(existing) > 2 and existing[2] is None:
        print("Cannot add command ", name, " because it has already been added by a different owner.")
        return False
    _commands[name] = function
    return True


def monitor_command(original, monitor):
    response = _rpc("monitor", original, monitor)
    if response[0]:
        return response[1:]
    return _report(response)


def remove_command_monitor(original, monitor):
    response = _rpc("remove-monitor", original, monitor)
    if response[0]:
        return response[1:]
    return _report(response)


def remove_command(name):
    _commands.pop(name, None)
    response = _rpc("remove", name)
    if response[0]:
        return True
    return _report(response)
