# Phonic Python Examples

This folder level specifies the Python environment (via pyproject.toml) that is used by all the examples
in the subdirectories.

This repository uses [uv](https://docs.astral.sh/uv/) for package management.
To get started, run the following:
```bash
git clone https://github.com/Phonic-Co/phonic-examples
cd phonic-examples/python
uv venv
source .venv/bin/activate
uv pip install -e .
```

To configure your environment, follow these steps:
1. Obtain a Phonic API Key by visiting the [Phonic API Keys](https://phonic.co/api-keys) page and creating an API key.
2. Create an `.env.local` file in this directory (`phonic-examples/python`) with the following content:
```dotenv
PHONIC_API_KEY="your_api_key"
```
