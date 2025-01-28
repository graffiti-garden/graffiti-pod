# Graffiti Federated Implementation: Pod Server

This is a "pod" server for a federated implementation of the [Graffiti API](https://api.graffiti.garden/classes/Graffiti.html).
The corresponding client is [adjacent in this repository](../client).

This server uses the [PouchDB Implementation](https://github.com/graffiti-garden/implementation-pouchdb)
of the Graffiti API under the hood,
but wraps it with [Solid OIDC](https://solid.github.io/solid-oidc/) for portable authentication.

## Development

### Setup

Since this server uses [PouchDB](https://pouchdb.com/), it can be run both with or without a separate database.
For production, we will stand up a [CouchDB](https://couchdb.apache.org/) instance via docker,
but for development and testing, we can use either an in-memory database or a dockerized CouchDB instance.

To use the in-memory database, simply install the package locally by running the following in the root of the repository:

```bash
npm install
```

To use the dockerized CouchDB instance, first install [Docker](https://docs.docker.com/engine/install/#server) and [Docker Compose](https://docs.docker.com/compose/install/).
Then, run the following command in the root of the repository:

```bash
sudo docker compose up --build
```

Then in another terminal launch a shell with:

```bash
sudo docker compose exec graffiti-pod sh
```

Use this shell to run the commands listed below. When you are done, you can stop the container (in the original shell) with:

```bash
docker compose down --remove-orphans
```

### Running

Once setup, you can run the server.

```bash
npm start
```

The application will be up at [localhost:3000](http://localhost:3000).

See `package.json` for more scripts.

### Testing

Some of the tests require a Solid login, so in the root of the repository, create a `.env` file defining [static Solid login credentials](https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-nodejs-script/#authenticate-with-statically-registered-client-credentials).
You can register for free credentials at [Inrupt](https://login.inrupt.com/registration.html). For example:

```bash
SOLID_CLIENT_ID=12345678-1234-...
SOLID_CLIENT_SECRET=12345678-1234-...
SOLID_OIDC_ISSUER=https://login.inrupt.com
```

Also, make sure the web server is not be running as it conflicts with tests, i.e. kill `npm start`.

Then run the following:

```bash
npm test
```

See `package.json` for more test scripts.
For example, you can watch for changes and test a particular file like the `store.controller` module:

```bash
npm run test:watch store.controller
```

## Deployment

Make sure the server has [Docker engine and compose](https://docs.docker.com/engine/install/#server) and [Certbot](https://certbot.eff.org/instructions) installed.

Purchase a domain name if you don't already have one and add a DNS entry for your domain, where `DOMAIN` is replaced with your desired domain (for example `graffiti.example.com`), and `DOMAIN_IP` is the IP of the server:

```
DOMAIN. 1800 IN A SERVER_IP
```

Once you can ping `DOMAIN` and get your server's IP (it can take up to an hour for DNS changes to propogate), run:

```bash
sudo certbot certonly --standalone -d DOMAIN
```

Create a user-owned `/srv/docker` folder, `cd` into it and, clone this repository.

```bash
sudo mkdir /srv/docker
sudo chown -R $(whoami):$(whoami) /srv/docker
cd /srv/docker
git clone https://github.com/graffiti-garden/graffiti-pod
```

In the root of the repository, create a `.env` file defining your domain.

```bash
echo "DOMAIN=graffiti.example.com" >> graffiti-pod/.env
```

Finally, link the service file into `systemd` and enable it.

```bash
sudo ln -f graffiti-pod/config/system/graffiti-pod.service /etc/systemd/system/
sudo systemctl enable --now graffiti-pod.service
```

You can check on the status with

```bash
sudo systemctl status graffiti-pod.service
```

or restart with

```bash
sudo systemctl restart graffiti-pod.service
```
