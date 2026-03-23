def _shorten_label(label):
    if label and "." in label:
        return label.rsplit(".", 1)[1]
    return label or ""


def __nengo_extract_model_structure():
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
        return {"error": "No nengo.Network instance found in globals"}
    try:
        obj_to_name = __nengo_build_obj_to_name(globals(), model)
        ensembles = []
        for i, e in enumerate(model.all_ensembles):
            raw = obj_to_name.get(e) or e.label or f"Ensemble_{i}"
            ensembles.append(_shorten_label(raw))
        nodes = []
        for i, n in enumerate(model.all_nodes):
            raw = obj_to_name.get(n) or n.label or f"Node_{i}"
            nodes.append(_shorten_label(raw))
        probes = []
        for i, p in enumerate(model.all_probes):
            raw = obj_to_name.get(p) or p.label or f"probe_{i}"
            probes.append(_shorten_label(raw))
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
        return {
            "ensembles": ensembles,
            "nodes": nodes,
            "probes": probes,
            "connections": connections,
        }
    except Exception as e:
        return {"error": str(e)}
