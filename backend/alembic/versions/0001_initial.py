"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None

role_enum = postgresql.ENUM(
    'ADMIN',
    'MANAGER',
    'EMPLOYEE',
    name='roleenum',
    create_type=False,
)
def upgrade():
    role_enum.create(op.get_bind(), checkfirst=True)
    op.create_table('departments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(160), nullable=False, unique=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(80), nullable=False, unique=True, index=True),
        sa.Column('full_name', sa.String(160), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('role', role_enum, nullable=False, server_default='EMPLOYEE'),
        sa.Column('department_id', sa.Integer(), sa.ForeignKey('departments.id'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.create_table('tasks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('department_id', sa.Integer(), sa.ForeignKey('departments.id'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('department_id','name', name='uq_department_task'))
    op.create_table('task_todos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('task_id', sa.Integer(), sa.ForeignKey('tasks.id'), nullable=False, index=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('weight', sa.Numeric(8,2), nullable=False, server_default='1'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('task_id','title', name='uq_task_todo'))
    op.create_table('timesheets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('department_id', sa.Integer(), sa.ForeignKey('departments.id'), nullable=False, index=True),
        sa.Column('task_id', sa.Integer(), sa.ForeignKey('tasks.id'), nullable=False),
        sa.Column('todo_id', sa.Integer(), sa.ForeignKey('task_todos.id'), nullable=False),
        sa.Column('work_date', sa.Date(), nullable=False, index=True),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('focused_minutes', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('action', sa.String(120), nullable=False),
        sa.Column('entity_type', sa.String(120), nullable=False),
        sa.Column('entity_id', sa.String(80), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))

def downgrade():
    op.drop_table('audit_logs'); op.drop_table('timesheets'); op.drop_table('task_todos'); op.drop_table('tasks'); op.drop_table('users'); op.drop_table('departments')
    role_enum.drop(op.get_bind(), checkfirst=True)
