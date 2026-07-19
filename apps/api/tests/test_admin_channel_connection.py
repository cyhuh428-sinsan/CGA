from app.api.routes import admin


def test_default_kakao_channel_starts_without_token_auth() -> None:
    kakao = next(item for item in admin.DEFAULT_ADMIN_CHANNELS if item["code"] == "KAKAO")

    assert kakao["provider"] == "kakao"
    assert kakao["renderer_type"] == "kakao"
    assert kakao["endpoint_url"] == "/api/v1/channels/kakao/webhook"
    assert kakao["auth_type"] == "none"


def test_kakao_channel_connection_issues_accept_initial_no_auth_setup() -> None:
    issues = admin._channel_connection_issues(
        status_value="active",
        provider="kakao",
        renderer_type="kakao",
        endpoint_url="/api/v1/channels/kakao/webhook",
        auth_type="none",
        auth_config={},
    )

    assert issues == []

def test_kakao_channel_connection_issues_accept_valid_token_setup() -> None:
    issues = admin._channel_connection_issues(
        status_value="active",
        provider="kakao",
        renderer_type="kakao",
        endpoint_url="/api/v1/channels/kakao/webhook",
        auth_type="token",
        auth_config={"appSecret": "demo-secret"},
    )

    assert issues == []


def test_kakao_channel_connection_issues_reject_invalid_renderer_and_endpoint() -> None:
    issues = admin._channel_connection_issues(
        status_value="active",
        provider="kakao",
        renderer_type="webchat",
        endpoint_url="/api/v1/channels/webchat/message",
        auth_type="none",
        auth_config={},
    )

    assert "카카오 채널은 renderer_type이 kakao여야 합니다." in issues
    assert "카카오 채널 Endpoint URL은 /api/v1/channels/kakao/webhook 형식이어야 합니다." in issues


def test_kakao_channel_connection_issues_require_token_value_when_token_auth() -> None:
    issues = admin._channel_connection_issues(
        status_value="active",
        provider="kakao",
        renderer_type="kakao",
        endpoint_url="/api/v1/channels/kakao/webhook",
        auth_type="token",
        auth_config={},
    )

    assert "인증 방식이 설정되어 있으나 인증 정보가 비어 있습니다." in issues
    assert "카카오 token 인증은 auth_config에 token 또는 appSecret 값이 필요합니다." in issues


def test_kakao_channel_connection_issues_reject_unsupported_auth_type() -> None:
    issues = admin._channel_connection_issues(
        status_value="active",
        provider="kakao",
        renderer_type="kakao",
        endpoint_url="/api/v1/channels/kakao/webhook",
        auth_type="oauth",
        auth_config={"clientId": "demo"},
    )

    assert "카카오 채널은 auth_type으로 none 또는 token만 지원합니다." in issues
