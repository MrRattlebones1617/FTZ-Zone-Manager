FTZ Zone Manager
=================

Local repo prepared for push.

Quick start (Windows)

1. Install Node.js LTS (>= 20). Download from https://nodejs.org/
2. Install MySQL Server 8.x (or use MySQL Workbench to create the database).
3. Open PowerShell in this project folder.

Install dependencies:

```powershell
cd "C:\Path\To\FTZ Zone Manager"
npm install
```

Create or confirm `.env` with database settings (example):

```text
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_DATABASE=ftz_zone_manager
PORT=3000
```

Create/import the DB (recommended):

```powershell
mysql -u root -p < database.sql
```

Start the app:

```powershell
npm start
```

Open http://localhost:3000

Git / GitHub
-------------
A local git repository has been initialized and the project committed (no remote set).

To push to your GitHub repository, either create an empty repo on GitHub and follow the instructions below, or provide the repository URL so I can add it for you.

Example commands (HTTPS, using GitHub personal access token):

```powershell
# set remote (replace <your-repo-url> with the HTTPS URL from GitHub)
git remote add origin https://github.com/your-username/your-repo.git

# push (first push, main branch may be named 'master' here)
git push -u origin master
```

If GitHub asks for credentials, you can use Git Credential Manager for Windows or paste a personal access token when prompted.

Example commands (SSH):

```powershell
# set remote (SSH)
git remote add origin git@github.com:your-username/your-repo.git

git push -u origin master
```

Security note: avoid pasting raw PATs into shells. Use `git credential-manager` or configure SSH keys.

If you want, provide the GitHub repo URL and whether you prefer HTTPS+PAT or SSH and I will add the remote and push for you (you will need to supply a PAT or have SSH keys already configured on the Windows PC).