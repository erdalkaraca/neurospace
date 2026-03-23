def _shorten_label(label):
    if label and "." in label:
        return label.rsplit(".", 1)[1]
    return label or ""


def __nengo_advance(session_id, steps):
    _sessions = globals().get("_nengo_sessions", {})
    session = _sessions.get(session_id)
    if session is None:
        return {"error": f"Unknown session: {session_id}"}
    model = session["model"]
    sim = session["sim"]
    obj_to_name = session.get("obj_to_name", {})
    try:
        sim.run_steps(steps, progress_bar=False)
        trange = sim.trange().tolist()
        probes = {}
        probe_dims = {}
        probe_labels = {}
        for i, p in enumerate(model.all_probes):
            key = f"probe_{i}"
            raw = obj_to_name.get(p) or p.label or key
            probe_labels[key] = _shorten_label(raw)
            arr = sim.data[p]
            if arr.ndim == 1:
                arr = arr.reshape(-1, 1)
            probe_dims[key] = int(arr.shape[1])
            probes[key] = arr.flatten(order='C').tolist()
        ensembles = []
        for i, e in enumerate(model.all_ensembles):
            raw = obj_to_name.get(e) or e.label or f"Ensemble_{i}"
            ensembles.append(_shorten_label(raw))
        nodes = []
        for i, n in enumerate(model.all_nodes):
            raw = obj_to_name.get(n) or n.label or f"Node_{i}"
            nodes.append(_shorten_label(raw))
        _ens_list = list(model.all_ensembles)
        _node_list = list(model.all_nodes)
        _obj_to_name = {}
        for i, e in enumerate(_ens_list):
            _obj_to_name[e] = ensembles[i]
        for i, n in enumerate(_node_list):
            _obj_to_name[n] = nodes[i]
        connections = []
        try:
            def _conn_pre(c):
                pre = c.pre_obj
                if hasattr(pre, "ensemble"):
                    pre = pre.ensemble
                return pre

            def _conn_post(c):
                post = c.post_obj
                if hasattr(post, "connection") and hasattr(post.connection, "post"):
                    post = post.connection.post
                    if hasattr(post, "obj"):
                        post = post.obj
                if hasattr(post, "ensemble"):
                    post = post.ensemble
                return post

            def _conn_kind(c):
                if getattr(c, "kind", None) == "modulatory":
                    return "modulatory"
                post = c.post_obj
                if hasattr(post, "connection"):
                    return "modulatory"
                return "normal"

            for c in model.all_connections:
                pre, post = _conn_pre(c), _conn_post(c)
                if pre is None or post is None:
                    continue
                pre_name = _obj_to_name.get(pre)
                post_name = _obj_to_name.get(post)
                if pre_name and post_name:
                    connections.append({"pre": pre_name, "post": post_name, "kind": _conn_kind(c)})
        except Exception:
            pass
        return {"trange": trange, "probes": probes, "probe_dims": probe_dims, "probe_labels": probe_labels, "ensembles": ensembles, "nodes": nodes, "connections": connections, "probes_list": list(probes.keys())}
    except Exception as e:
        return {"error": str(e)}
