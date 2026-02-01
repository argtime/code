# V-X9 CRYPT - GitHub Pages Deployment

## Setup

1. Push this repository to GitHub
2. In GitHub repository settings, go to **Pages**
3. Set source to **Deploy from a branch**
4. Select **gh-pages** branch (will be auto-created on first workflow run)

## GitHub Actions

The workflow (`.github/workflows/build.yml`) automatically:
- Compiles TypeScript with Vite
- Runs on every push to main/master
- Deploys to GitHub Pages

No manual build steps required!

## Custom Domain (Optional)

Edit `.github/workflows/build.yml` and uncomment:
```yaml
cname: your-custom-domain.com
```

## Usage

### Encrypt with Default Key
1. Enter message
2. Click "Encrypt"
3. Copy the binary blob

### Use Custom Key
1. Click the Key icon (⚙️)
2. Generate or import a custom key
3. Enable "Use Custom Key"
4. Encrypt/Decrypt with that key

### Share Keys
Custom keys are 88 bytes encoded in Base64 - paste anywhere to share with others who can import them.
