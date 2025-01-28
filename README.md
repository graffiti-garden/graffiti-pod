# Graffiti Federated Pods Implementation

This is a federated implementation of the [Graffiti API](https://api.graffiti.garden/classes/Graffiti.html).
It contains both a Typescript [client](./client) that runs in the browser
and a node.js "pod" [server](./server).

As a federated implementation, it is designed for multiple pods
to be deployed. Users can choose which pod(s) they want to host their data,
including a self-hosted one, while still being able to interact with users on pods.

The servers largely have their own HTTP interface, but authenitcation is
done through the [Solid OIDC](https://solid.github.io/solid-oidc/) standard,
allowing users to log in with any Solid OIDC provider and then authenticate
with any pod.
