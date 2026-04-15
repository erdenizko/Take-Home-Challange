PYTHON = venv/bin/python
PIP = venv/bin/pip

.PHONY: dev install

install:
	python3 -m venv venv
	$(PIP) install -r requirements.txt
	cd frontend && npm install

dev:
	@trap 'kill 0' EXIT; \
	$(PYTHON) app.py & \
	cd frontend && npm run dev
