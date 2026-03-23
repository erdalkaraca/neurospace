"""2D harmonic oscillator with recurrent connections."""

import nengo

model = nengo.Network()
with model:
    ens = nengo.Ensemble(n_neurons=200, dimensions=2)
    stim = nengo.Node(lambda t: [1, 0] if t < 0.1 else [0, 0])
    nengo.Connection(stim, ens)
    nengo.Connection(ens, ens, transform=[[1, 1], [-1, 1]], synapse=0.1)
    p_ens = nengo.Probe(ens, synapse=0.01)
