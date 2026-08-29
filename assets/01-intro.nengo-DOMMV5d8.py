"""Nengo intro: input node → neural ensemble."""

import nengo

model = nengo.Network()
with model:
    stim = nengo.Node(0)
    ens = nengo.Ensemble(n_neurons=50, dimensions=1)
    nengo.Connection(stim, ens)
    p_ens = nengo.Probe(ens, synapse=0.01)
