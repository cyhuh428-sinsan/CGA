from __future__ import annotations

import sys
from pathlib import Path
import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))

from scripts.security.public_repo_policy import (  # noqa: E402
    collect_tracked_paths,
    find_content_violations,
    find_path_violations,
)


def test_public_readmes_are_allowed() -> None:
    violations = find_path_violations(
        [
            "README.md",
            "README.en.md",
            "README.zh-CN.md",
            "README.ja.md",
            "README.vi.md",
            "README.fr.md",
            "README.de.md",
        ]
    )

    assert violations == []


def test_internal_documents_are_rejected() -> None:
    violations = find_path_violations(
        [
            "README.es.md",
            "docs/testing/report.md",
            "docs/manual/cga-user-manual/README.ko.md",
        ]
    )

    assert "README.es.md:non-manual-document" in violations
    assert "docs/testing/report.md:non-manual-document" in violations
    assert all(
        "docs/manual/cga-user-manual/README.ko.md" not in item
        for item in violations
    )


def test_sensitive_values_are_reported_without_value(tmp_path: Path) -> None:
    sample = tmp_path / "sample.py"
    sensitive_value = "cy" + "huh"
    sample.write_text(f'owner = "{sensitive_value}"\n', encoding="utf-8")

    violations = find_content_violations(tmp_path, ["sample.py"])

    assert violations == ["sample.py:1:personal-identifier"]
    assert sensitive_value not in violations[0]


def test_reserved_example_domains_are_allowed(tmp_path: Path) -> None:
    sample = tmp_path / "sample.py"
    sample.write_text(
        'primary = "qa@example.com"\nsecondary = "qa@example.invalid"\n',
        encoding="utf-8",
    )

    assert find_content_violations(tmp_path, ["sample.py"]) == []


def test_database_dsn_is_not_reported_as_an_email(tmp_path: Path) -> None:
    sample = tmp_path / "sample.py"
    sample.write_text(
        'dsn = "postgresql://db_user@127.0.0.1:5432/app"\n',
        encoding="utf-8",
    )

    assert find_content_violations(tmp_path, ["sample.py"]) == []


def test_current_git_index_has_no_private_documents() -> None:
    paths = collect_tracked_paths(REPO_ROOT)

    assert find_path_violations(paths) == []


def test_public_fixtures_have_no_personal_identifiers() -> None:
    paths = (
        "compat-samples/Aidot 봇_v1.json",
        "compat-samples/dialog-flow-Rich Form.json",
        "apps/api/tests/integration/test_bot_persistence_regression.py",
        "apps/api/tests/test_admin_operations_dashboard.py",
        "apps/api/tests/test_llm_intent.py",
        "apps/web/lib/entity-assets.ts",
    )

    assert find_content_violations(REPO_ROOT, paths) == []


def test_current_tracked_text_has_no_sensitive_identifiers() -> None:
    paths = collect_tracked_paths(REPO_ROOT)

    assert find_content_violations(REPO_ROOT, paths) == []


def test_secret_scan_workflow_is_immutable_and_full_history() -> None:
    workflow = (REPO_ROOT / ".github/workflows/secret-scan.yml").read_text(
        encoding="utf-8"
    )

    assert "3d3c42e5aac5ba805825da76410c181273ba90b1" in workflow
    assert "fetch-depth: 0" in workflow
    assert "GITLEAKS_VERSION: 8.30.1" in workflow
    assert "061476c21adaf5441516f96f185c1a4706a83cd6329b9b38762271b3d4a52fae" in workflow
    assert "gitleaks git --redact" in workflow
    assert "python scripts/security/public_repo_policy.py --repo ." in workflow


def test_office_and_pdf_manuals_are_treated_as_binary() -> None:
    attributes = (REPO_ROOT / ".gitattributes").read_text(encoding="utf-8")

    assert "*.docx binary" in attributes
    assert "*.pdf binary" in attributes


GOOGLE_LITERAL_CASES = [
    ('chat@system.gserviceaccount.com', 'apps/api/app/services/channel_connection_google_chat_auth.py'),
    ('qa@cga-qa-project.iam.gserviceaccount.com', 'apps/api/tests/test_channel_connection_google_chat_runtime.py'),
    ('second@cga-qa-project.iam.gserviceaccount.com', 'apps/api/tests/test_channel_connection_google_chat_runtime.py'),
    ('rotated@cga-qa-project.iam.gserviceaccount.com', 'apps/api/tests/test_channel_connection_google_chat_runtime.py'),
]


@pytest.mark.parametrize('address,provider_path', GOOGLE_LITERAL_CASES)
@pytest.mark.parametrize('location', ['provider','policy','regression'])
def test_only_approved_google_literal_and_path_pairs_are_public(tmp_path,address,provider_path,location):
    path={'provider':provider_path,'policy':'scripts/security/public_repo_policy.py',
        'regression':'apps/api/tests/test_public_repo_policy.py'}[location]
    sample=tmp_path/path;sample.parent.mkdir(parents=True,exist_ok=True);sample.write_text(address,encoding='utf-8')
    assert find_content_violations(tmp_path,[path])==[]


@pytest.mark.parametrize('address,provider_path', GOOGLE_LITERAL_CASES)
@pytest.mark.parametrize('path', ['apps/api/tests/unrelated.py','apps/api/app/services/unrelated.py'])
def test_approved_google_address_in_other_path_is_still_rejected(tmp_path,address,provider_path,path):
    sample=tmp_path/path;sample.parent.mkdir(parents=True,exist_ok=True);sample.write_text(address,encoding='utf-8')
    assert find_content_violations(tmp_path,[path])==[path+':1:personal-email']


@pytest.mark.parametrize('address,provider_path', GOOGLE_LITERAL_CASES)
def test_google_addresses_cannot_exchange_auth_and_fixture_paths(tmp_path,address,provider_path):
    path=('apps/api/tests/test_channel_connection_google_chat_runtime.py' if provider_path.endswith('_auth.py')
        else 'apps/api/app/services/channel_connection_google_chat_auth.py')
    sample=tmp_path/path;sample.parent.mkdir(parents=True,exist_ok=True);sample.write_text(address,encoding='utf-8')
    assert find_content_violations(tmp_path,[path])==[path+':1:personal-email']


@pytest.mark.parametrize('address,provider_path', GOOGLE_LITERAL_CASES)
@pytest.mark.parametrize('change', ['localpart','project','domain','case'])
def test_other_google_account_or_project_domain_and_case_are_not_allowlisted(tmp_path,address,provider_path,change):
    if change=='localpart':value='unapproved-'+address
    elif change=='project':value=address.replace('cga-qa-project','unapproved-project').replace('@system.','@other.')
    elif change=='domain':value=address.replace('gserviceaccount.com','unapproved-account.com')
    else:value=address.upper()
    sample=tmp_path/provider_path;sample.parent.mkdir(parents=True,exist_ok=True);sample.write_text(value,encoding='utf-8')
    assert find_content_violations(tmp_path,[provider_path])==[provider_path+':1:personal-email']


@pytest.mark.parametrize('address,provider_path', GOOGLE_LITERAL_CASES)
def test_allowlisted_email_does_not_suppress_other_sensitive_rules_on_same_line(tmp_path,address,provider_path):
    sensitive='cy'+'huh';sample=tmp_path/provider_path;sample.parent.mkdir(parents=True,exist_ok=True)
    sample.write_text(address+' '+sensitive,encoding='utf-8')
    assert find_content_violations(tmp_path,[provider_path])==[provider_path+':1:personal-identifier']


@pytest.mark.parametrize('address,provider_path', GOOGLE_LITERAL_CASES)
def test_allowlisted_email_does_not_hide_another_account_on_same_line(tmp_path,address,provider_path):
    sample=tmp_path/provider_path;sample.parent.mkdir(parents=True,exist_ok=True)
    sample.write_text(address+' unapproved-'+address,encoding='utf-8')
    assert find_content_violations(tmp_path,[provider_path])==[provider_path+':1:personal-email']
