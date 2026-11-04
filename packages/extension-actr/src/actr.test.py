import importlib.util
import io
import contextlib
from pathlib import Path

path = Path(__file__).with_name("actr.py")
spec = importlib.util.spec_from_file_location("actr_client", path)
actr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(actr)

USED = {
    "add_button_to_exp_window",
    "add_command",
    "add_dm",
    "add_line_to_exp_window",
    "add_text_to_exp_window",
    "buffer_chunk",
    "buffer_read",
    "buffer_slot_value",
    "chunk_p",
    "chunk_slot_value",
    "clear_buffer",
    "clear_exp_window",
    "copy_chunk",
    "correlation",
    "define_chunks",
    "extend_possible_slots",
    "get_history_data",
    "get_time",
    "goal_focus",
    "install_device",
    "load_act_r_model",
    "mean_deviation",
    "mod_chunk",
    "mod_focus",
    "model_output",
    "modify_line_for_exp_window",
    "monitor_command",
    "mp_show_queue",
    "new_digit_sound",
    "new_tone_sound",
    "no_output",
    "open_exp_window",
    "pdisable",
    "permute_list",
    "print_activation_trace",
    "print_chunk_activation_trace",
    "print_dm_finsts",
    "print_warning",
    "process_events",
    "random",
    "record_history",
    "reload",
    "remove_command",
    "remove_command_monitor",
    "remove_items_from_exp_window",
    "reset",
    "run",
    "run_full_time",
    "saved_activation_history",
    "schedule_event_relative",
    "sdm",
    "sdp",
    "set_buffer_chunk",
    "set_parameter_value",
    "simulate_retrieval_request",
    "start_hand_at_mouse",
    "visible_virtuals_available",
    "whynot",
    "whynot_dm",
}


def test_units_api_is_present():
    missing = sorted(name for name in USED if not callable(getattr(actr, name, None)))
    assert missing == []


def test_disconnected_call_does_not_raise():
    actr.set_dispatcher(None)
    with contextlib.redirect_stdout(io.StringIO()) as out:
        assert actr.load_act_r_model("ACT-R:tutorial;unit1;count.lisp") is False
    assert "Could not start ACT-R connection." in out.getvalue()


def test_window_and_run_encoding():
    calls = []

    def send(method, params):
        calls.append((method, params))
        if method == "evaluate" and params[0] == "run":
            return [1.5, 4]
        if method == "evaluate" and params[0] == "permute-list":
            return [[1, 0]]
        if method == "check":
            return [None]
        if method == "add":
            return ["fan-response"]
        return [True]

    actr.set_dispatcher(send)
    window = actr.open_exp_window("Sentence Experiment", visible=False, width=600, height=300)
    actr.add_text_to_exp_window(window, "hippie", x=50, y=150, width=75)
    actr.schedule_event_relative(5, "show", params=["yes"], output="medium", time_in_ms=True)
    assert actr.run(30) == [1.5, 4]
    assert actr.permute_list(["a", "b"]) == ["b", "a"]

    assert calls[0] == (
        "evaluate",
        [
            "open-exp-window",
            False,
            "Sentence Experiment",
            [["visible", False], ["width", 600], ["height", 300], ["x", 300], ["y", 300]],
        ],
    )
    text = calls[1][1]
    assert text[0] == "add-text-to-exp-window"
    assert text[2] is True
    assert text[3] == "hippie"
    assert ["x", 50] in text[4] and ["font-size", 12] in text[4]
    options = calls[2][1][4]
    assert ["params", ["yes"]] in options
    assert ["output", "medium"] in options
    assert ["time-in-ms", True] in options


def test_add_command_registers_local_callback():
    calls = []

    def send(method, params):
        calls.append((method, params))
        if method == "check":
            return [None]
        if method == "add":
            return ["ok"]
        return [True]

    actr.set_dispatcher(send)
    seen = {}

    def respond(model, key):
        seen["value"] = (model, key)
        seen["during"] = actr.get_time()
        return key

    assert actr.add_command("fan-response", respond, "Fan experiment model response") == "ok"
    assert calls[0][0] == "check"
    assert calls[1][1][:4] == ["fan-response", "fan-response", "Fan experiment model response", True]
    assert actr.handle_command("fan-response", "count", ["count", "k"]) == "k"
    assert seen["value"] == ("count", "k")
    assert calls[-1] == ("evaluate", ["get-time", "count", True])


class JsNull:
    typeof = "object"

    def __bool__(self):
        return False

    def __repr__(self):
        return "jsnull"


def test_javascript_null_still_adds_a_missing_command():
    calls = []

    def send(method, params):
        calls.append(method)
        if method == "check":
            return {"result": [JsNull(), JsNull()], "callbacks": []}
        return {"result": [True], "callbacks": []}

    actr.set_dispatcher(send)

    def respond(model, key):
        return key

    assert actr.add_command("unit2-key-press", respond, "key") is True
    assert calls == ["check", "add"]


def test_process_events_waits_through_actr():
    calls = []

    def send(method, params):
        calls.append((method, params))
        return [None]

    actr.set_dispatcher(send)
    assert actr.process_events() is None
    assert calls == [("evaluate", ["process-events", False])]


def test_run_delivers_command_callbacks_before_returning():
    pressed = []

    def respond(model, key):
        pressed.append((model, key))

    def send(method, params):
        if method == "evaluate" and params[0] == "run":
            return {"result": [0.5, 3], "callbacks": [["unit2-key-press", ["unit2", "b"]]]}
        return [True]

    actr.set_dispatcher(send)
    actr._commands["unit2-key-press"] = respond
    assert actr.run(10, True) == [0.5, 3]
    assert pressed == [("unit2", "b")]
