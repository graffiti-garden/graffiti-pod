# Graffiti Pod

## Local Usage

To launch the container, run:

```bash
sudo docker compose up --build
```

Then in another terminal launch a shell with:

```bash
sudo docker compose exec graffiti-pod sh
```

To start the app run:

```bash
npm start
```

The application will be up at [localhost:3000](http://localhost:3000).

To stop the container run:

```bash
docker compose down --remove-orphans
```

### Testing

Some of the tests require a Solid login, so in the root of the repository, create a `.env` file defining [static Solid login credentials](https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-nodejs-script/#authenticate-with-statically-registered-client-credentials).
You can register for free credentials at [Inrupt](https://login.inrupt.com/registration.html). For example:

```bash
SOLID_CLIENT_ID=12345678-1234-...
SOLID_CLIENT_SECRET=12345678-1234-...
SOLID_OIDC_ISSUER=https://login.inrupt.com
```

Also, make sure the web server is not be running as it conflicts with tests, i.e. kill `npm start`.

To run all tests, run the following within the container shell created above:

```bash
npm test
```

To run a particular test, replace `store.service` with the name of the test file:

```bash
npm run test:watch store.service
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

## TODO:

- test for querying deleted/moved stuff
- Complete DHT implimentation
  - Watch for added channels, compute info hash, store the (channel, infoHash) pair for lookup in the database, and publish the info hash to the DHT
  - Watch for deleted channels and remove info hashes from the database and DHT as necessary
  - Have a recurring timer that keeps things in the DHT.
  - Add an endpoint that users can use to check if the server knows a particular channel, without revealing that channel, via the ZK proof.
- Create a recurring timer that deletes irrelevant tombstones
  - Return the expiration time in a meta data hook, so clients can know when their cache is stale
- Add endpoints for listing all user channels and posts
- Add endpoints for listing all user posts and/or posts with a specific channel
