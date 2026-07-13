"""
Marketplace Platform — Trust System & Digital Signatures.

Trust levels, signature verification, author identity.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from typing import Any

from marketplace.models import SignatureInfo, TrustLevel

logger = logging.getLogger(__name__)

# Demo author keys (in production, from registry)
_AUTHOR_KEYS: dict[str, str] = {
    "official001": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----",
    "community042": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----",
}


class TrustSystem:
    """Evaluates and manages package trust levels."""

    # Thresholds for automated trust evaluation
    MIN_INSTALLS_FOR_COMMUNITY = 50
    MIN_INSTALLS_FOR_VERIFIED = 500
    MIN_RATING_FOR_VERIFIED = 4.0
    MIN_AGE_DAYS_FOR_VERIFIED = 30

    def __init__(self) -> None:
        self._author_verification: dict[str, bool] = {}

    def evaluate_trust(self,
                       install_count: int,
                       rating: float,
                       age_days: float,
                       is_official: bool = False,
                       has_signature: bool = False,
                       reported_unsafe: bool = False) -> TrustLevel:
        """Automatically determine the appropriate trust level."""
        if reported_unsafe:
            return TrustLevel.UNSAFE
        if is_official:
            return TrustLevel.OFFICIAL
        if (install_count >= self.MIN_INSTALLS_FOR_VERIFIED
                and rating >= self.MIN_RATING_FOR_VERIFIED
                and age_days >= self.MIN_AGE_DAYS_FOR_VERIFIED
                and has_signature):
            return TrustLevel.VERIFIED
        if install_count >= self.MIN_INSTALLS_FOR_COMMUNITY:
            return TrustLevel.COMMUNITY
        return TrustLevel.EXPERIMENTAL

    def mark_deprecated(self, package_name: str) -> TrustLevel:
        """Mark a package as deprecated."""
        logger.info("Package %s marked as deprecated", package_name)
        return TrustLevel.DEPRECATED

    def mark_unsafe(self, package_name: str, reason: str) -> TrustLevel:
        """Mark a package as unsafe."""
        logger.warning("Package %s marked as unsafe: %s", package_name, reason)
        return TrustLevel.UNSAFE

    def verify_author(self, author_id: str, signature: SignatureInfo) -> bool:
        """Verify an author's identity via their signature."""
        # Cache result
        if author_id in self._author_verification:
            return self._author_verification[author_id]

        pub_key = _AUTHOR_KEYS.get(author_id)
        if not pub_key:
            self._author_verification[author_id] = False
            return False

        # In production: actual Ed25519 verification
        # For demo: check fingerprint match
        is_valid = len(signature.signature_hex) >= 32
        self._author_verification[author_id] = is_valid
        return is_valid

    def get_trust_display(self, level: TrustLevel) -> dict:
        """Get display info for a trust level."""
        displays = {
            TrustLevel.OFFICIAL: {
                'label': 'Official',
                'color': '#58a6ff',
                'icon': '✅',
                'description': 'Official Trading Workspace package',
            },
            TrustLevel.VERIFIED: {
                'label': 'Verified',
                'color': '#3fb950',
                'icon': '✔️',
                'description': 'Author verified by marketplace',
            },
            TrustLevel.COMMUNITY: {
                'label': 'Community',
                'color': '#8b949e',
                'icon': '👥',
                'description': 'Community-contributed package',
            },
            TrustLevel.EXPERIMENTAL: {
                'label': 'Experimental',
                'color': '#d29922',
                'icon': '🧪',
                'description': 'New, unproven package',
            },
            TrustLevel.DEPRECATED: {
                'label': 'Deprecated',
                'color': '#f85149',
                'icon': '⚠️',
                'description': 'No longer maintained',
            },
            TrustLevel.UNSAFE: {
                'label': 'Unsafe',
                'color': '#f85149',
                'icon': '🚫',
                'description': 'Known issues / security flags',
            },
        }
        return displays.get(level, displays[TrustLevel.COMMUNITY])


class SignatureVerifier:
    """Verifies package digital signatures."""

    @staticmethod
    def verify_package(data: bytes, signature: SignatureInfo) -> bool:
        """Verify a package archive against its signature."""
        if signature.algorithm == "sha256":
            expected = hashlib.sha256(data).hexdigest()
            return expected == signature.signature_hex
        elif signature.algorithm == "ed25519":
            # In production: actual Ed25519 verification with nacl/cryptography
            # For demo: accept if signature_hex is non-empty and matches hash prefix
            h = hashlib.sha256(data).hexdigest()
            return signature.signature_hex.startswith(h[:16])
        return False

    @staticmethod
    def create_signature(data: bytes, private_key: str) -> SignatureInfo:
        """Create a signature for package data (for publishers)."""
        h = hashlib.sha256(data).hexdigest()
        import time
        return SignatureInfo(
            author_id="publisher",
            signature_hex=h,
            algorithm="sha256",
            signed_at=time.time(),
        )

    @staticmethod
    def fingerprint(cert_pem: str) -> str:
        """Compute a fingerprint from a PEM certificate."""
        return hashlib.sha256(cert_pem.encode()).hexdigest()[:16]
