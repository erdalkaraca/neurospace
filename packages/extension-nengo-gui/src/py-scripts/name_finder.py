def _name_finder_find_names(known_name, net, net_name):
    import nengo
    base_lists = ["ensembles", "nodes", "connections", "networks"]
    all_lists = [
        "all_ensembles", "all_nodes", "all_connections",
        "all_networks", "all_objects", "all_probes",
    ]
    classes = (nengo.Node, nengo.Ensemble, nengo.Network, nengo.Connection)

    for inst_attr in dir(net):
        if inst_attr.startswith("_") or inst_attr in base_lists + all_lists:
            continue
        try:
            attr = getattr(net, inst_attr)
        except Exception:
            continue
        if isinstance(attr, list):
            for i, obj in enumerate(attr):
                try:
                    if obj not in known_name:
                        known_name[obj] = "%s.%s[%d]" % (net_name, inst_attr, i)
                except TypeError:
                    pass
        elif isinstance(attr, classes):
            try:
                if attr not in known_name:
                    known_name[attr] = "%s.%s" % (net_name, inst_attr)
            except TypeError:
                pass

    for obj_type in base_lists:
        try:
            for i, obj in enumerate(getattr(net, obj_type)):
                try:
                    if known_name.get(obj, None) is None:
                        known_name[obj] = "%s.%s[%d]" % (net_name, obj_type, i)
                except TypeError:
                    pass
        except Exception:
            pass

    for n in net.networks:
        sub_name = known_name.get(n)
        if sub_name is None:
            sub_name = "%s.networks[%d]" % (net_name, list(net.networks).index(n))
            known_name[n] = sub_name
        _name_finder_find_names(known_name, n, sub_name)


def __nengo_build_obj_to_name(terms, model):
    known_name = {}
    for k, v in list(terms.items()):
        if k.startswith("_"):
            continue
        try:
            known_name[v] = k
        except TypeError:
            pass
    try:
        model_name = known_name.get(model)
    except TypeError:
        model_name = None
    if model_name is None:
        model_name = "model"
        try:
            known_name[model] = model_name
        except TypeError:
            pass
    _name_finder_find_names(known_name, model, model_name)
    return known_name
