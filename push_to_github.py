import os
import subprocess
import urllib.request
import json
import sys

# Read GITHUB_PERSONAL_ACCESS_TOKEN
token = os.getenv("GITHUB_PERSONAL_ACCESS_TOKEN")
if not token:
    if os.path.exists("../.env"):
        with open("../.env") as f:
            for line in f:
                if "GITHUB_PERSONAL_ACCESS_TOKEN=" in line:
                    token = line.split("=", 1)[1].strip()
                    break

if not token:
    print("Error: No GITHUB_PERSONAL_ACCESS_TOKEN found!")
    sys.exit(1)

repo_name = "luffy-ascension"
url = "https://api.github.com/user/repos"
headers = {
    "Authorization": f"token {token}",
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": "Antigravity-Deployer"
}
data = json.dumps({"name": repo_name, "private": False, "auto_init": False}).encode("utf-8")

req = urllib.request.Request(url, data=data, headers=headers, method="POST")
clone_url = None

try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        clone_url = res["clone_url"]
        print(f"Successfully created GitHub repository: {clone_url}")
except Exception as e:
    print(f"Repository creation warning/error: {e}")
    # Try fetching user name to build URL if it already exists
    try:
        req_user = urllib.request.Request("https://api.github.com/user", headers=headers)
        with urllib.request.urlopen(req_user) as resp_user:
            user_data = json.loads(resp_user.read().decode())
            username = user_data["login"]
            clone_url = f"https://github.com/{username}/{repo_name}.git"
            print(f"Using clone URL: {clone_url}")
    except Exception as e2:
        print(f"Failed to fetch username: {e2}")
        sys.exit(1)

if not clone_url:
    print("Error: Could not determine clone URL.")
    sys.exit(1)

# Initialize git and push
subprocess.run(["git", "init"])
subprocess.run(["git", "config", "user.name", "Antigravity Agent"])
subprocess.run(["git", "config", "user.email", "agent@antigravity.ai"])
subprocess.run(["git", "add", "."])
subprocess.run(["git", "commit", "-m", "Initial commit: Luffy's Ascension game"])
subprocess.run(["git", "branch", "-M", "main"])

# Remove existing remote if any
subprocess.run(["git", "remote", "remove", "origin"])

# Setup auth in clone url
auth_url = clone_url.replace("https://", f"https://x-token-auth:{token}@")
subprocess.run(["git", "remote", "add", "origin", auth_url])
res_push = subprocess.run(["git", "push", "-u", "origin", "main"], capture_output=True, text=True)
print("Push output:", res_push.stdout)
print("Push error:", res_push.stderr)
