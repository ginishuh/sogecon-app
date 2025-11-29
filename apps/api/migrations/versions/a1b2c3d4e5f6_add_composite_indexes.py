"""add composite indexes for query optimization

Revision ID: a1b2c3d4e5f6
Revises: b0defb6bab2f
Create Date: 2025-11-29 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'b0defb6bab2f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # RSVP: event_id + status 조회 최적화
    op.create_index(
        'ix_rsvps_event_status',
        'rsvps',
        ['event_id', 'status'],
    )

    # NotificationPreference: member_id + channel 조회 최적화
    op.create_index(
        'ix_notif_pref_member_channel',
        'notification_preferences',
        ['member_id', 'channel'],
    )

    # PushSubscription: 활성 구독 조회용 partial index
    # list_active_subscriptions()가 revoked_at IS NULL만 필터하므로
    # id 컬럼에 partial index를 걸어 활성 구독만 인덱싱
    op.create_index(
        'ix_push_subs_active',
        'push_subscriptions',
        ['id'],
        postgresql_where='revoked_at IS NULL',
    )


def downgrade() -> None:
    op.drop_index('ix_push_subs_active', table_name='push_subscriptions')
    op.drop_index('ix_notif_pref_member_channel', table_name='notification_preferences')
    op.drop_index('ix_rsvps_event_status', table_name='rsvps')
