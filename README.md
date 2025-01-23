# Graffiti Federated Implementation

This is a federated implementation of the [Graffiti API](https://api.graffiti.garden/classes/Graffiti.html).
It contains both a Typescript [client](./client) that runs in the browser
and node.js [server](./server).
As a federated implementation, it is designed for multiple server instances
to be deployed with users choosing which server to use for their data,
including the option to run their own server.
