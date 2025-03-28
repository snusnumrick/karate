import { useState, useEffect, useCallback } from 'react';
import { Form } from '@remix-run/react';
import { supabaseClient } from '~/utils/supabase.client';
import type { Family, Guardian, Student } from '~/types/models';
import { mapFamilyFromSupabase, mapGuardianFromSupabase, mapStudentFromSupabase } from '~/utils/mappers';
import { mapFamilyToSupabase, mapGuardianToSupabase, mapStudentToSupabase } from '~/utils/mappers';

interface FamilyManagerProps {
  familyId?: string;
  onSave?: (family: Family) => void;
}

export default function FamilyManager({ familyId, onSave }: FamilyManagerProps) {
  const [family, setFamily] = useState<Family>({
    id: '',
    name: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    primaryPhone: '',
    email: '',
    guardians: [],
    students: [],
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadFamily = useCallback(async (id: string) => {
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
      
      if (data) {
        const mappedFamily = mapFamilyFromSupabase(data);
        mappedFamily.guardians = data.guardians.map(mapGuardianFromSupabase);
        mappedFamily.students = data.students.map(mapStudentFromSupabase);
        setFamily(mappedFamily);
      } else {
        setFamily({
          id: '',
          name: '',
          address: '',
          city: '',
          province: '',
          postalCode: '',
          primaryPhone: '',
          email: '',
          guardians: [],
          students: [],
        });
      }
    } catch (err) {
      console.error('Error loading family:', err);
      setError('Failed to load family information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (familyId) {
      loadFamily(familyId).then(() => {
        if (!isMounted) return;
      });
    }
    return () => { isMounted = false; };
  }, [familyId, loadFamily]);


  async function saveFamily() {
    setLoading(true);
    setError(null);
    
    try {
      // Convert to Supabase format
      const dbFamily = mapFamilyToSupabase(family);
      
      // Save family record
      const { data: familyData, error: familyError } = familyId 
        ? await supabaseClient
            .from('families')
            .update(dbFamily)
            .eq('id', familyId)
            .select()
            .single()
        : await supabaseClient
            .from('families')
            .insert(dbFamily)
            .select()
            .single();
            
      if (familyError) throw familyError;
      
      const newFamilyId = familyData?.id || familyId || '';
      
      // Save guardians
      const guardianPromises = family.guardians.map(async (guardian) => {
        const dbGuardian = mapGuardianToSupabase({
          ...guardian,
          familyId: newFamilyId
        });
        
        if (guardian.id) {
          return supabaseClient
            .from('guardians')
            .update(dbGuardian)
            .eq('id', guardian.id);
        } else {
          return supabaseClient
            .from('guardians')
            .insert(dbGuardian);
        }
      });
      
      // Save students
      const studentPromises = family.students.map(async (student) => {
        const dbStudent = mapStudentToSupabase({
          ...student,
          familyId: newFamilyId
        });
        
        if (student.id) {
          return supabaseClient
            .from('students')
            .update(dbStudent)
            .eq('id', student.id);
        } else {
          return supabaseClient
            .from('students')
            .insert(dbStudent);
        }
      });
      
      // Execute all operations
      const results = await Promise.all([
        ...guardianPromises,
        ...studentPromises
      ]);
      
      // Check for errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`Failed to save ${errors.length} related records`);
      }
      
      if (onSave) {
        onSave({
          ...mapFamilyFromSupabase(familyData),
          guardians: family.guardians,
          students: family.students
        });
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
        {
          id: '',
          firstName: '',
          lastName: '',
          relationship: '',
          homePhone: '',
          cellPhone: '',
          email: '',
          employer: '',
          employerPhone: '',
          employerNotes: '',
          workPhone: ''
        }
      ]
    });
  }

  function addStudent() {
    setFamily({
      ...family,
      students: [
        ...family.students,
        {
          id: '',
          firstName: '',
          lastName: '',
          gender: '',
          birthDate: '',
          tShirtSize: '',
          school: '',
          gradeLevel: '',
          immunizationsUpToDate: false,
          beltRank: 'white',
          familyId: family.id
        }
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
    <div className="space-y-6 dark:text-gray-100">
      <h2 className="text-2xl font-bold">{familyId ? 'Edit Family' : 'New Family'}</h2>
      
      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded">
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
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium">Address</label>
          <input
            type="text"
            value={family.address}
            onChange={(e) => setFamily({ ...family, address: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium">Phone</label>
          <input
            type="tel"
            value={family.primaryPhone}
            onChange={(e) => setFamily({ ...family, primaryPhone: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            value={family.email}
            onChange={(e) => setFamily({ ...family, email: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
          />
        </div>
      </div>
      
      <div>
        <h3 className="text-xl font-semibold">Guardians</h3>
        {family.guardians.map((guardian, index) => (
          <div key={index} className="mt-4 p-4 border rounded dark:border-gray-600 dark:bg-gray-800">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">First Name</label>
                <input
                  type="text"
                  value={guardian.firstName}
                  onChange={(e) => updateGuardian(index, { firstName: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Last Name</label>
                <input
                  type="text"
                  value={guardian.lastName}
                  onChange={(e) => updateGuardian(index, { lastName: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Relationship</label>
                <input
                  type="text"
                  value={guardian.relationship}
                  onChange={(e) => updateGuardian(index, { relationship: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Home Phone</label>
                <input
                  type="tel"
                  value={guardian.homePhone}
                  onChange={(e) => updateGuardian(index, { homePhone: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Cell Phone</label>
                <input
                  type="tel"
                  value={guardian.cellPhone}
                  onChange={(e) => updateGuardian(index, { cellPhone: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={guardian.email}
                  onChange={(e) => updateGuardian(index, { email: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addGuardian}
          className="mt-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
        >
          Add Guardian
        </button>
      </div>
      
      <div>
        <h3 className="text-xl font-semibold">Students</h3>
        {family.students.map((student, index) => (
          <div key={index} className="mt-4 p-4 border rounded dark:border-gray-600 dark:bg-gray-800">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">First Name</label>
                <input
                  type="text"
                  value={student.firstName}
                  onChange={(e) => updateStudent(index, { firstName: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Last Name</label>
                <input
                  type="text"
                  value={student.lastName}
                  onChange={(e) => updateStudent(index, { lastName: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Birth Date</label>
                <input
                  type="date"
                  value={student.birthDate}
                  onChange={(e) => updateStudent(index, { birthDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Belt Rank</label>
                <select
                  value={student.beltRank}
                  onChange={(e) => updateStudent(index, { beltRank: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
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
              <div>
                <label className="block text-sm font-medium">Gender</label>
                <select
                  value={student.gender}
                  onChange={(e) => updateStudent(index, { gender: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">School</label>
                <input
                  type="text"
                  value={student.school}
                  onChange={(e) => updateStudent(index, { school: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Grade Level</label>
                <input
                  type="text"
                  value={student.gradeLevel}
                  onChange={(e) => updateStudent(index, { gradeLevel: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-green-500 dark:focus:ring-green-400"
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addStudent}
          className="mt-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
        >
          Add Student
        </button>
      </div>
      
      <div className="flex justify-between">
        <button
          type="button"
          onClick={saveFamily}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          {loading ? 'Saving...' : 'Save Family'}
        </button>
        
        {family.id && (
          <Form method="post" action="/api/create-checkout-session">
            <input type="hidden" name="familyId" value={family.id} />
            <input type="hidden" name="amount" value="9900" />
            <input type="hidden" name="studentIds" 
                  value={JSON.stringify(family.students.map(s => s.id))} />
                  
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Pay Registration Fee ($99)
            </button>
          </Form>
        )}
      </div>
    </div>
  );
}
