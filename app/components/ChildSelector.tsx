import { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '~/utils/supabase.client';
import type { Student } from '~/types/models';
import { mapStudentFromSupabase } from '~/utils/mappers';

interface ChildSelectorProps {
  familyId?: string;
  selectedIds?: string[];
  onChange?: (selectedStudents: Student[]) => void;
  maxSelections?: number;
}

export default function ChildSelector({ 
  familyId, 
  selectedIds = [], 
  onChange,
  maxSelections = 0 
}: ChildSelectorProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadStudents = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabaseClient
        .from('students')
        .select('*')
        .eq('family_id', id);
        
      if (error) throw error;
      
      // Map database rows to Student objects
      setStudents(data?.map(mapStudentFromSupabase) || []);
    } catch (err) {
      console.error('Error loading students:', err);
      setError('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [supabaseClient]);

  useEffect(() => {
    let isMounted = true;
    if (familyId) {
      loadStudents(familyId);
    }
    return () => { isMounted = false; };
  }, [familyId, loadStudents]);

  useEffect(() => {
    // Initialize selected students based on selectedIds
    if (selectedIds.length > 0 && students.length > 0) {
      const selected = students.filter(student => selectedIds.includes(student.id));
      setSelectedStudents(selected);
    }
  }, [selectedIds, students]);


  function handleStudentToggle(student: Student) {
    let updatedSelection;
    
    if (selectedStudents.some(s => s.id === student.id)) {
      // Remove student if already selected
      updatedSelection = selectedStudents.filter(s => s.id !== student.id);
    } else {
      // Add student if not at max selections
      if (maxSelections > 0 && selectedStudents.length >= maxSelections) {
        return; // Don't add if at max selections
      }
      updatedSelection = [...selectedStudents, student];
    }
    
    setSelectedStudents(updatedSelection);
    
    if (onChange) {
      onChange(updatedSelection);
    }
  }

  if (loading) {
    return <div>Loading students...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (students.length === 0) {
    return <div>No students found for this family.</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Select Children</h3>
      
      <div className="space-y-2">
        {students.map(student => (
          <div key={student.id} className="flex items-center">
            <input
              type="checkbox"
              id={`student-${student.id}`}
              checked={selectedStudents.some(s => s.id === student.id)}
              onChange={() => handleStudentToggle(student)}
              className="h-4 w-4 text-blue-600 rounded"
              aria-label={`Select ${student.firstName} ${student.lastName}`}
            />
            <label htmlFor={`student-${student.id}`} className="ml-2">
              {student.firstName} {student.lastName} ({student.beltRank} belt)
            </label>
          </div>
        ))}
      </div>
      
      {maxSelections > 0 && (
        <div className="text-sm text-gray-500">
          Selected {selectedStudents.length} of {maxSelections} maximum
        </div>
      )}
    </div>
  );
}
