from __future__ import annotations

import signal
from threading import Event

from app.api.routes.bots import process_queued_nlu_training_events, recover_interrupted_nlu_training_events
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.db.session import SessionLocal


configure_logging()
logger = get_logger("aidot.nlu_training_worker")
stop_requested = Event()


def _sleep_seconds(interval: float, consecutive_failures: int) -> float:
    if consecutive_failures <= 0:
        return interval
    max_backoff = max(interval, float(settings.nlu_training_worker_error_backoff_seconds))
    return min(max_backoff, interval * (2 ** max(0, consecutive_failures - 1)))


def _recover_interrupted_jobs() -> int:
    with SessionLocal() as db:
        return recover_interrupted_nlu_training_events(db)


def _process_next_job() -> int:
    with SessionLocal() as db:
        return len(process_queued_nlu_training_events(db, limit=1))


def _request_stop(signum: int, _frame: object) -> None:
    logger.info(
        "NLU training worker stop requested.",
        extra={"event": "nlu.training.worker_stop_requested", "extra_data": {"signal": signum}},
    )
    stop_requested.set()


def run() -> None:
    interval = max(0.5, float(settings.nlu_training_worker_interval_seconds))
    recovered_count = _recover_interrupted_jobs()
    logger.info(
        "NLU training worker started.",
        extra={
            "event": "nlu.training.worker_started",
            "extra_data": {"interval_seconds": interval, "recovered": recovered_count},
        },
    )
    consecutive_failures = 0

    while not stop_requested.is_set():
        try:
            processed_count = _process_next_job()
            if processed_count:
                logger.info(
                    "NLU training worker processed queued jobs.",
                    extra={"event": "nlu.training.worker_processed", "extra_data": {"processed": processed_count}},
                )
            consecutive_failures = 0
        except Exception as error:
            consecutive_failures += 1
            logger.exception(
                "NLU training worker failed.",
                extra={
                    "event": "nlu.training.worker_failed",
                    "extra_data": {
                        "error_type": type(error).__name__,
                        "error_message": str(error),
                        "consecutive_failures": consecutive_failures,
                    },
                },
            )
        stop_requested.wait(_sleep_seconds(interval, consecutive_failures))

    logger.info("NLU training worker stopped.", extra={"event": "nlu.training.worker_stopped"})


def main() -> None:
    signal.signal(signal.SIGINT, _request_stop)
    signal.signal(signal.SIGTERM, _request_stop)
    run()


if __name__ == "__main__":
    main()
