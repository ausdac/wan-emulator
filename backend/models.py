"""
Pydantic models for WANEmulator V2 API.
"""
from __future__ import annotations

import ipaddress
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class FilterConfig(BaseModel):
    """Per-direction traffic filter using tc flower classifier.
    All specified fields are ANDed together.  Unmatched traffic passes through unimpaired.
    """
    enabled: bool = False
    src_ip: Optional[str] = Field(None, description="Source IP or CIDR, e.g. 192.168.1.0/24")
    dst_ip: Optional[str] = Field(None, description="Destination IP or CIDR")
    src_port: Optional[int] = Field(None, ge=1, le=65535)
    dst_port: Optional[int] = Field(None, ge=1, le=65535)
    protocol: Optional[Literal["tcp", "udp", "icmp"]] = None
    dscp: Optional[int] = Field(None, ge=0, le=63, description="DSCP value 0-63")
    vlan_id: Optional[int] = Field(None, ge=1, le=4094, description="802.1Q VLAN ID")
    mpls_label: Optional[int] = Field(None, ge=0, le=1048575, description="MPLS label")

    @field_validator("src_ip", "dst_ip", mode="before")
    @classmethod
    def validate_ip(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        try:
            ipaddress.ip_network(v, strict=False)
        except ValueError:
            try:
                ipaddress.ip_address(v)
            except ValueError:
                raise ValueError(f"Invalid IP address or CIDR: {v!r}")
        return v

    def has_any_criteria(self) -> bool:
        return any([
            self.src_ip, self.dst_ip,
            self.src_port is not None, self.dst_port is not None,
            self.protocol is not None,
            self.dscp is not None,
            self.vlan_id is not None,
            self.mpls_label is not None,
        ])

    def is_active(self) -> bool:
        return self.enabled and self.has_any_criteria()


class DirectionImpairment(BaseModel):
    # ── Core netem params ──────────────────────────────────────────────────
    delay_ms: float = Field(default=0.0, ge=0, le=60000, description="One-way delay ms")
    jitter_ms: float = Field(default=0.0, ge=0, le=10000, description="Jitter ± ms")
    delay_correlation: float = Field(default=0.0, ge=0, le=100,
                                     description="Delay/jitter correlation %")
    loss_percent: float = Field(default=0.0, ge=0, le=100)
    loss_correlation: float = Field(default=0.0, ge=0, le=100, description="Loss correlation %")
    duplicate_percent: float = Field(default=0.0, ge=0, le=100)
    duplicate_correlation: float = Field(default=0.0, ge=0, le=100)
    reorder_percent: float = Field(default=0.0, ge=0, le=100)
    reorder_correlation: float = Field(default=0.0, ge=0, le=100)
    bandwidth_mbit: float = Field(default=0.0, ge=0, le=400000, description="0 = unlimited")

    # ── V2: new impairment types ───────────────────────────────────────────
    corrupt_percent: float = Field(default=0.0, ge=0, le=100,
                                   description="Bit-error / corruption probability")
    corrupt_correlation: float = Field(default=0.0, ge=0, le=100)

    # Gilbert-Elliott burst loss model (replaces simple loss when enabled)
    burst_loss_enabled: bool = False
    burst_loss_prob: float = Field(default=0.0, ge=0, le=100,
                                   description="Probability of entering a burst loss period (%)")
    burst_loss_avg_length: float = Field(default=2.0, ge=1, le=1000,
                                         description="Average number of consecutive packets dropped in a burst")

    # ── V2: per-direction traffic filter ──────────────────────────────────
    filter: Optional[FilterConfig] = None

    @model_validator(mode="after")
    def _validate(self) -> "DirectionImpairment":
        if self.burst_loss_enabled and self.burst_loss_prob <= 0:
            raise ValueError("burst_loss_prob must be > 0 when burst_loss_enabled is True")
        if self.jitter_ms > 0 and self.delay_ms <= 0:
            raise ValueError("jitter_ms requires delay_ms > 0")
        return self


class LinkImpairmentRequest(BaseModel):
    enabled: bool = True
    a_to_b: DirectionImpairment = Field(default_factory=DirectionImpairment)
    b_to_a: DirectionImpairment = Field(default_factory=DirectionImpairment)


class ProfileSaveRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_\- ]+$")
    description: str = Field(default="", max_length=256)
    settings: Dict[str, LinkImpairmentRequest]


class ProfileInfo(BaseModel):
    name: str
    description: str
    created_at: str
    updated_at: str


class PresetInfo(BaseModel):
    name: str
    description: str
    category: str


class LinkStatus(BaseModel):
    id: str
    name: str
    physical_label: str
    iface_a: str
    iface_b: str
    bridge: str
    description: str
    label: str
    bridge_up: bool
    impairment_enabled: bool
    current_settings: Optional[LinkImpairmentRequest]



class IfaceStats(BaseModel):
    bytes_sent: int = 0
    packets_sent: int = 0
    dropped: int = 0
    overlimits: int = 0
    requeues: int = 0
    drop_percent: float = 0.0
    history: List[Dict] = Field(default_factory=list)


class LiveStatsResponse(BaseModel):
    link_id: str
    iface_a: IfaceStats
    iface_b: IfaceStats


class CommandResult(BaseModel):
    success: bool
    message: str
    commands: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
