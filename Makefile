.PHONY: dev-up dev-smoke dev-qa dev-logs prod-up prod-smoke prod-qa prod-logs down all-smoke all-qa

dev-up:
	docker compose up -d app

dev-smoke:
	docker compose run --rm smoke

dev-qa:
	docker compose run --rm qa

dev-logs:
	docker compose logs -f app

prod-up:
	docker compose --profile prod up -d app-prod

prod-smoke:
	docker compose --profile prod run --rm smoke-prod

prod-qa:
	docker compose --profile prod run --rm qa-prod

prod-logs:
	docker compose --profile prod logs -f app-prod

all-smoke: dev-up dev-smoke prod-up prod-smoke

all-qa: dev-up dev-qa prod-up prod-qa

down:
	docker compose --profile prod down
