import uuid

_nengo_sessions = {}


def __nengo_init_sim():
    import nengo
    model = None
    for _name, _obj in list(globals().items()):
        try:
            if isinstance(_obj, nengo.Network):
                model = _obj
                break
        except Exception:
            continue
    if model is None:
        return {"error": "No nengo.Network instance found in globals", "ok": False}
    try:
        with model:
            if len(model.all_probes) == 0:
                for ens in model.all_ensembles:
                    nengo.Probe(ens, synapse=0.01)
        obj_to_name = __nengo_build_obj_to_name(globals(), model)
        from threadpoolctl import threadpool_limits
        from nengo import Simulator
        with threadpool_limits(limits=1, user_api='blas'):
            sim = Simulator(model, progress_bar=False)
        session_id = str(uuid.uuid4())
        _nengo_sessions[session_id] = {"model": model, "sim": sim, "obj_to_name": obj_to_name}
        return {"session_id": session_id, "dt": float(sim.dt), "ok": True}
    except Exception as e:
        return {"error": str(e), "ok": False}
