# Deployment & SSL Guide for Collab-Pad

Follow these steps to deploy your application to a Digital Ocean Droplet with SSL.

## 1. Prerequisites
- A Digital Ocean Droplet (Ubuntu recommended).
- Docker and Docker Compose installed on the Droplet.
- Your domain `collabpad.duckdns.org` pointing to your Droplet's IP.

## 2. Prepare the Server
Copy your project files to the Droplet (using `git clone` or `scp`).

## 3. Run the Application (Initial Setup)
Run the following command to start the services in the background:
```bash
docker-compose up -d --build
```
At this point, your app should be accessible at `http://collabpad.duckdns.org`.

## 4. Generate SSL Certificates
Run this command to request a certificate from Let's Encrypt:
```bash
docker-compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot/ -d collabpad.duckdns.org
```
Follow the prompts (enter your email, agree to terms).

## 5. Enable HTTPS in Nginx
Once the certificates are generated, you need to update `nginx.conf` to use them.

1. Open `nginx.conf`.
2. Uncomment the `return 301 https://$host$request_uri;` line in the HTTP server block.
3. Uncomment the entire `server` block for HTTPS (port 443).
4. Save the file.

## 6. Reload Nginx
Apply the changes by reloading the Nginx service:
```bash
docker-compose exec nginx nginx -s reload
```

## 7. Update Client Origin (Optional but Recommended)
In `server/.env` and `docker-compose.yml`, change `http://collabpad.duckdns.org` to `https://collabpad.duckdns.org` to ensure all links and CORS policies use HTTPS.

After changing environment variables, rebuild:
```bash
docker-compose up -d --build
```

## Summary of Commands
- **Start**: `docker-compose up -d`
- **Stop**: `docker-compose down`
- **Logs**: `docker-compose logs -f`
- **Rebuild**: `docker-compose up -d --build`
