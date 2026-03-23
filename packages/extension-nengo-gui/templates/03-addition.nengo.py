"""Addition: two inputs summed in a neural ensemble."""

import nengo

model = nengo.Network()
with model:
    stim_a = nengo.Node(0.5)
    stim_b = nengo.Node(-0.3)
    ens_sum = nengo.Ensemble(n_neurons=80, dimensions=1)
    nengo.Connection(stim_a, ens_sum)
    nengo.Connection(stim_b, ens_sum)
    p_sum = nengo.Probe(ens_sum, synapse=0.01)
