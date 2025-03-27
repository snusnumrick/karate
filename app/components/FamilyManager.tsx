import { useState, useEffect } from 'react';
import { supabaseClient } from '~/utils/supabase.client';
import type { Family, Guardian, Student } from '~/types/models';

interface FamilyManagerProps {
  familyId?: string;
  onSave?: (family: Family) => void;
}

export default function FamilyManager({ familyId, onSave }: FamilyManagerProps) {
  const [family, setFamily] = useState<Family>({
    id: '',
    name: '',
    address: '',
    phone: '',
    email: '',
    guardians: [],
    students: [],
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (familyId) {
      loadFamily(familyId);
    }
  }, [familyId]);

  async function loadFamily(id: string) {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabaseClient
        .from('families')
        .select(`
          *,
          guardians (*),
          students (*)
        `)
        .eq('id', id)
        .single();
        
      if (error) throw error;
      
      setFamily(data || {
        id: '',
        name: '',
        address: '',
        phone: '',
        email: '',
        guardians: [],
        students: [],
      });
    } catch (err) {
      console.error('Error loading family:', err);
      setError('Failed to load family information');
    } finally {
      setLoading(false);
    }
  }

  async function saveFamily() {
    setLoading(true);
    setError(null);
    
    try {
      // Save family record
      const { data: familyData, error: familyError } = familyId 
        ? await supabaseClient
            .from('families')
            .update({
              name: family.name,
              address: family.address,
              phone: family.phone,
              email: family.email,
            })
            .eq('id', familyId)
            .select()
            .single()
        : await supabaseClient
            .from('families')
            .insert({
              name: family.name,
              address: family.address,
              phone: family.phone,
              email: family.email,
            })
            .select()
            .single();
            
      if (familyError) throw familyError;
      
      const newFamilyId = familyData?.id || '';
      
      // Process guardians and students
      // This is simplified - in a real app you'd handle updates, deletions, etc.
      
      if (onSave) {
        onSave(familyData);
      }
    } catch (err) {
      console.error('Error saving family:', err);
      setError('Failed to save family information');
    } finally {
      setLoading(false);
    }
  }

  function addGuardian() {
    setFamily({
      ...family,
      guardians: [
        ...family.guardians,
        { id: '', name: '', relationship: '', phone: '', email: '' }
      ]
    });
  }

  function addStudent() {
    setFamily({
      ...family,
      students: [
        ...family.students,
        { id: '', name: '', birthDate: '', beltRank: 'white' }
      ]
    });
  }

  function updateGuardian(index: number, guardian: Partial<Guardian>) {
    const updatedGuardians = [...family.guardians];
    updatedGuardians[index] = { ...updatedGuardians[index], ...guardian };
    setFamily({ ...family, guardians: updatedGuardians });
  }

  function updateStudent(index: number, student: Partial<Student>) {
    const updatedStudents = [...family.students];
    updatedStudents[index] = { ...updatedStudents[index], ...student };
    setFamily({ ...family, students: updatedStudents });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{familyId ? 'Edit Family' : 'New Family'}</h2>
      
      {error && (
        <div className="p-4 bg-red-100 text-red-800 rounded">
          {error}
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Family Name</label>
          <input
            type="text"
            value={family.name}
            onChange={(e) => setFamily({ ...family, name: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium">Address</label>
          <input
            type="text"
            value={family.address}
            onChange={(e) => setFamily({ ...family, address: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium">Phone</label>
          <input
            type="tel"
            value={family.phone}
            onChange={(e) => setFamily({ ...family, phone: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            value={family.email}
            onChange={(e) => setFamily({ ...family, email: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>
      </div>
      
      <div>
        <h3 className="text-xl font-semibold">Guardians</h3>
        {family.guardians.map((guardian, index) => (
          <div key={index} className="mt-4 p-4 border rounded">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={guardian.name}
                  onChange={(e) => updateGuardian(index, { name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Relationship</label>
                <input
                  type="text"
                  value={guardian.relationship}
                  onChange={(e) => updateGuardian(index, { relationship: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Phone</label>
                <input
                  type="tel"
                  value={guardian.phone}
                  onChange={(e) => updateGuardian(index, { phone: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={guardian.email}
                  onChange={(e) => updateGuardian(index, { email: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addGuardian}
          className="mt-2 px-4 py-2 bg-blue-100 text-blue-700 rounded"
        >
          Add Guardian
        </button>
      </div>
      
      <div>
        <h3 className="text-xl font-semibold">Students</h3>
        {family.students.map((student, index) => (
          <div key={index} className="mt-4 p-4 border rounded">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={student.name}
                  onChange={(e) => updateStudent(index, { name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Birth Date</label>
                <input
                  type="date"
                  value={student.birthDate}
                  onChange={(e) => updateStudent(index, { birthDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Belt Rank</label>
                <select
                  value={student.beltRank}
                  onChange={(e) => updateStudent(index, { beltRank: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                >
                  <option value="white">White</option>
                  <option value="yellow">Yellow</option>
                  <option value="orange">Orange</option>
                  <option value="green">Green</option>
                  <option value="blue">Blue</option>
                  <option value="purple">Purple</option>
                  <option value="brown">Brown</option>
                  <option value="black">Black</option>
                </select>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addStudent}
          className="mt-2 px-4 py-2 bg-blue-100 text-blue-700 rounded"
        >
          Add Student
        </button>
      </div>
      
      <div className="flex justify-end">
        <button
          type="button"
          onClick={saveFamily}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Family'}
        </button>
      </div>
    </div>
  );
}
