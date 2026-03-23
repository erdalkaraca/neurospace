"""Communication channel: signal passes through two ensembles."""

import nengo

model = nengo.Network()
with model:
    stim = nengo.Node(lambda t: 0.5 * (1 if t < 0.5 else -1))
    ens_a = nengo.Ensemble(n_neurons=50, dimensions=1)
    ens_b = nengo.Ensemble(n_neurons=50, dimensions=1)
    nengo.Connection(stim, ens_a)
    nengo.Connection(ens_a, ens_b)
    p_a = nengo.Probe(ens_a, synapse=0.01)
    p_b = nengo.Probe(ens_b, synapse=0.01)
