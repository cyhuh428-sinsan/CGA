from __future__ import annotations

from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query, Response, status
from fastapi.responses import FileResponse
from app.core.config import ROOT_DIR

router = APIRouter(prefix="/richform", tags=["richform"])

_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
_ALLOWED_LOCAL_IMAGE_ROOTS = [
    Path("C:/Temp"),
    Path("D:/Temp"),
    Path("C:/tmp"),
    ROOT_DIR / "temp",
    ROOT_DIR / "storage" / "temp",
    ROOT_DIR / "bot-images",
    ROOT_DIR / "storage" / "bot-images",
    Path("/home/ubuntu/deploy/Aidot/temp"),
    Path("/home/ubuntu/deploy/Aidot/bot-images"),
    Path("/home/ubuntu/deploy/Aidot/storage/temp"),
    Path("/home/ubuntu/deploy/Aidot/storage/bot-images"),
]


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


@router.get("/local-image")
def local_richform_image(path: str = Query(min_length=1)) -> FileResponse:
    requested = Path(path).expanduser()
    if not requested.is_absolute():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="절대 경로만 사용할 수 있습니다.")

    try:
        resolved = requested.resolve(strict=True)
    except OSError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="이미지 파일을 찾을 수 없습니다.") from None

    if resolved.suffix.lower() not in _IMAGE_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="지원하지 않는 이미지 형식입니다.")

    allowed_roots = []
    for root in _ALLOWED_LOCAL_IMAGE_ROOTS:
        try:
            allowed_roots.append(root.resolve(strict=False))
        except OSError:
            allowed_roots.append(root)

    if not any(_is_relative_to(resolved, root) for root in allowed_roots):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="허용되지 않은 이미지 경로입니다.")

    return FileResponse(resolved)

@router.get("/image")
def remote_richform_image(url: str = Query(min_length=1)) -> Response:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="http/https 이미지 주소만 사용할 수 있습니다.")

    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 Aidot-RichForm/1.0",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
    )
    try:
        with urlopen(request, timeout=10) as remote:  # noqa: S310 - user-provided URLs are restricted to image proxying.
            content_type = remote.headers.get("Content-Type", "application/octet-stream").split(";", 1)[0].strip().lower()
            if content_type and not (content_type.startswith("image/") or content_type == "application/octet-stream"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미지 응답이 아닙니다.")
            return Response(content=remote.read(), media_type=content_type or "application/octet-stream")
    except HTTPException:
        raise
    except HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"이미지를 가져오지 못했습니다. ({exc.code})") from None
    except (OSError, URLError, TimeoutError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="이미지를 가져오지 못했습니다.") from None
