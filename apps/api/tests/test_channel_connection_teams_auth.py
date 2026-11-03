"""합성 RSA JWT만 사용하는 Teams 인증 경계 검증."""
import json
import time
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException


@pytest.fixture
def signed():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    client = str(uuid4())
    now = int(time.time())
    claims = dict(iss="https://api.botframework.com", aud=client, nbf=now-30,
                  exp=now+600, serviceurl="https://smba.trafficmanager.net/amer/")
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    jwk.update(kid="synthetic-key", alg="RS256", use="sig", endorsements=["msteams"])
    activity = dict(channelId="msteams", serviceUrl=claims["serviceurl"])
    calls = []
    def transport(url):
        calls.append(url)
        if url == "https://login.botframework.com/v1/.well-known/openidconfiguration":
            return dict(issuer=claims["iss"], jwks_uri="https://login.botframework.com/v1/.well-known/keys",
                        id_token_signing_alg_values_supported=["RS256"])
        assert url == "https://login.botframework.com/v1/.well-known/keys"
        return {"keys": [jwk]}
    def token(changes=None, kid="synthetic-key"):
        return jwt.encode({**claims, **(changes or {})}, key, algorithm="RS256", headers={"kid": kid})
    return client, claims, jwk, activity, calls, transport, token


def test_signed_request_exact_app_service_and_cached_keys(signed):
    from app.services.channel_connection_teams_auth import TeamsAuthenticator
    client, claims, jwk, activity, calls, transport, token = signed
    auth = TeamsAuthenticator(transport=transport)
    result = auth.authenticate("Bearer " + token(), activity, client)
    assert result.client_id == client and result.service_url == activity["serviceUrl"]
    auth.authenticate("bearer " + token(), activity, client)
    assert len(calls) == 2


@pytest.mark.parametrize("changes", [
    {"iss": "https://attacker.invalid"}, {"aud": "other-app"}, {"aud": ["other-app"]},
    {"exp": 1}, {"nbf": 9999999999}, {"exp": True}, {"exp": None},
    {"serviceurl": "https://smba.trafficmanager.net/emea/"}, {"serviceurl": None},
    {"serviceUrl": "https://smba.trafficmanager.net/emea/"},
])
def test_invalid_signed_identity_is_rejected(signed, changes):
    from app.services.channel_connection_teams_auth import TeamsAuthenticator
    client, claims, jwk, activity, calls, transport, token = signed
    raw = token(changes)
    with pytest.raises(HTTPException) as error:
        TeamsAuthenticator(transport=transport).authenticate("Bearer " + raw, activity, client)
    assert error.value.status_code in {401, 403}
    assert raw not in str(error.value.detail)


@pytest.mark.parametrize("url", [
    "http://smba.trafficmanager.net/amer/", "https://127.0.0.1/", "https://169.254.169.254/",
    "https://smba.trafficmanager.net.attacker.invalid/amer/", "https://smba.trafficmanager.net:444/amer/",
    "https://user:pass" + "@" + "smba.trafficmanager.net/amer/", "https://smba.trafficmanager.net/../",
    "https://smba.trafficmanager.net/%2e%2e/", "https://smba.trafficmanager.net/amer/?x=y",
    "https://smba.trafficmanager.net/amer/#x",
])
def test_untrusted_service_destination_rejected(url):
    from app.services.channel_connection_teams_auth import validate_teams_service_url
    with pytest.raises(HTTPException):
        validate_teams_service_url(url)


def test_algorithm_channel_and_unknown_kid_fail_closed(signed):
    from app.services.channel_connection_teams_auth import TeamsAuthenticator
    client, claims, jwk, activity, calls, transport, token = signed
    auth = TeamsAuthenticator(transport=transport)
    raw = jwt.encode(claims, "synthetic-only-hmac-secret-32-bytes", algorithm="HS256", headers={"kid": "synthetic-key"})
    with pytest.raises(HTTPException): auth.authenticate("Bearer " + raw, activity, client)
    assert not calls
    auth.authenticate("Bearer " + token(), activity, client)
    for _ in range(3):
        with pytest.raises(HTTPException): auth.authenticate("Bearer " + token(kid="missing"), activity, client)
    assert len(calls) == 2
    jwk["endorsements"] = ["webchat"]
    with pytest.raises(HTTPException):
        TeamsAuthenticator(transport=transport).authenticate("Bearer " + token(), activity, client)


def test_untrusted_metadata_jwks_never_followed(signed):
    from app.services.channel_connection_teams_auth import TeamsAuthenticator
    client, claims, jwk, activity, calls, transport, token = signed
    def malicious(url):
        calls.append(url)
        return dict(issuer=claims["iss"], jwks_uri="https://attacker.invalid/keys",
                    id_token_signing_alg_values_supported=["RS256"])
    with pytest.raises(HTTPException):
        TeamsAuthenticator(transport=malicious).authenticate("Bearer " + token(), activity, client)
    assert len(calls) == 1


def test_wrong_signature_rejected(signed):
    from app.services.channel_connection_teams_auth import TeamsAuthenticator
    client, claims, jwk, activity, calls, transport, token = signed
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    raw = jwt.encode(claims, other, algorithm="RS256", headers={"kid":"synthetic-key"})
    with pytest.raises(HTTPException):
        TeamsAuthenticator(transport=transport).authenticate("Bearer " + raw, activity, client)


def test_http_redirect_handler_never_follows_location():
    from app.services.channel_connection_teams_auth import _NoRedirect
    assert _NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://attacker.invalid") is None
