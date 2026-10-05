# Deploy Kursiv to Azure App Service

The GitHub Actions workflow builds the Vite client, bundles the Express server and production dependencies, then deploys the combined app to Azure App Service. The app uses one origin for the UI and API.

## 1. Create the database

1. Activate the MongoDB Atlas offer from the GitHub Student Developer Pack, if it is available in your account.
2. Create a cluster, a database user, and a database named `course_studio`.
3. Create the Azure web app in the next section, then add its outbound IP addresses to the Atlas network access list.
4. Copy the Atlas connection string. Replace the password placeholder with the database user's password; keep the string private.

## 2. Create the Azure web app

Create an **Azure App Service Web App** with Linux and Node.js 24 LTS. Choose the Azure for Students subscription. Set the startup command to `npm start`.

In **Settings → Environment variables**, add:

| Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas connection string for `course_studio` |
| `JWT_SECRET` | Random private string, at least 32 characters |
| `UPLOAD_DIR` | `/home/uploads` |

`/home` is App Service's persistent content directory. The application creates `/home/uploads` on startup, so uploaded lesson materials and student submissions survive restarts. Keep the app on one instance while using this local folder; for scaling to multiple instances, move uploads to shared object storage.

## 3. Connect the GitHub workflow

In Azure, download the web app's **publish profile**. In the GitHub repository, open **Settings → Secrets and variables → Actions** and add:

- `AZURE_WEBAPP_NAME`: the Azure web app name.
- `AZURE_WEBAPP_PUBLISH_PROFILE`: the complete downloaded publish profile XML.

The workflow deploys when code is pushed to `master`; it can also be run manually from **Actions → Deploy Kursiv to Azure App Service → Run workflow**.

## 4. Create the first administrator

Once Atlas is configured, set `MONGODB_URI` in the project root `.env` to the same Atlas connection string, then run:

```sh
npm run create-admin --prefix server -- admin@example.com 'A-long-private-password' 'Имя' 'Фамилия'
```

The `.env` file is ignored by Git. Do not put database credentials or the JWT secret in source code or GitHub commits.

## 5. Check the deployment

Open `https://<your-app-name>.azurewebsites.net/healthz`. A response of `{"ok":true}` means the server and database are connected. Then open the root URL and sign in with the administrator account.
