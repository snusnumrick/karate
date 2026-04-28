import { describe, expect, it, vi } from 'vitest';
import { deleteClass } from '../class.server';

function createThenableQuery(result: { data?: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.delete = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.then = (
    onFulfilled: (value: { data?: unknown; error: unknown }) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return query;
}

describe('deleteClass', () => {
  it('hard deletes the class row when there are no active enrollments', async () => {
    const enrollmentsQuery = createThenableQuery({ data: [], error: null });
    const classesQuery = createThenableQuery({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'enrollments') return enrollmentsQuery;
        if (table === 'classes') return classesQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    await deleteClass('class-1', supabase as never);

    expect(supabase.from).toHaveBeenCalledWith('enrollments');
    expect(supabase.from).toHaveBeenCalledWith('classes');
    expect(enrollmentsQuery.select).toHaveBeenCalledWith('id');
    expect((enrollmentsQuery.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(['class_id', 'class-1']);
    expect((enrollmentsQuery.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(['status', 'active']);
    expect(classesQuery.delete).toHaveBeenCalledTimes(1);
    expect(classesQuery).not.toHaveProperty('update');
    expect((classesQuery.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(['id', 'class-1']);
  });

  it('blocks deletion when active enrollments exist', async () => {
    const enrollmentsQuery = createThenableQuery({ data: [{ id: 'enrollment-1' }], error: null });
    const classesQuery = createThenableQuery({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'enrollments') return enrollmentsQuery;
        if (table === 'classes') return classesQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    await expect(deleteClass('class-1', supabase as never)).rejects.toThrow(
      'Cannot delete class with active enrollments'
    );
    expect(classesQuery.delete).not.toHaveBeenCalled();
  });
});
