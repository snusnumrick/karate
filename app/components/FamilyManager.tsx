import { useState, useEffect, useCallback } from 'react';
import { Form } from '@remix-run/react';
import { supabaseClient } from '~/utils/supabase.client';
import type { Family, Guardian, Student } from '~/types/models';
import { mapFamilyFromSupabase, mapGuardianFromSupabase, mapStudentFromSupabase } from '~/utils/mappers';
import { mapFamilyToSupabase, mapGuardianToSupabase, mapStudentToSupabase } from '~/utils/mappers';
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "~/components/ui/select";

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
          beltRank: 'white' as const,
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
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="family-name">Family Name</Label>
          <Input
            id="family-name"
            type="text"
            value={family.name}
            onChange={(e) => setFamily({ ...family, name: e.target.value })}
          />
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            type="text"
            value={family.address}
            onChange={(e) => setFamily({ ...family, address: e.target.value })}
          />
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={family.primaryPhone}
            onChange={(e) => setFamily({ ...family, primaryPhone: e.target.value })}
          />
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={family.email}
            onChange={(e) => setFamily({ ...family, email: e.target.value })}
          />
        </div>
      </div>
      
      <div>
        <h3 className="text-xl font-semibold">Guardians</h3>
        {family.guardians.map((guardian, index) => (
          <Card key={index} className="mt-4 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor={`guardian-first-name-${index}`}>First Name</Label>
                <Input
                  id={`guardian-first-name-${index}`}
                  type="text"
                  value={guardian.firstName}
                  onChange={(e) => updateGuardian(index, { firstName: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`guardian-last-name-${index}`}>Last Name</Label>
                <Input
                  id={`guardian-last-name-${index}`}
                  type="text"
                  value={guardian.lastName}
                  onChange={(e) => updateGuardian(index, { lastName: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`guardian-relationship-${index}`}>Relationship</Label>
                <Input
                  id={`guardian-relationship-${index}`}
                  type="text"
                  value={guardian.relationship}
                  onChange={(e) => updateGuardian(index, { relationship: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`guardian-home-phone-${index}`}>Home Phone</Label>
                <Input
                  id={`guardian-home-phone-${index}`}
                  type="tel"
                  value={guardian.homePhone}
                  onChange={(e) => updateGuardian(index, { homePhone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`guardian-cell-phone-${index}`}>Cell Phone</Label>
                <Input
                  id={`guardian-cell-phone-${index}`}
                  type="tel"
                  value={guardian.cellPhone}
                  onChange={(e) => updateGuardian(index, { cellPhone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`guardian-email-${index}`}>Email</Label>
                <Input
                  id={`guardian-email-${index}`}
                  type="email"
                  value={guardian.email}
                  onChange={(e) => updateGuardian(index, { email: e.target.value })}
                />
              </div>
            </div>
          </Card>
        ))}
        <Button 
          type="button" 
          onClick={addGuardian}
          variant="outline"
          className="mt-2"
        >
          Add Guardian
        </Button>
      </div>
      
      <div>
        <h3 className="text-xl font-semibold">Students</h3>
        {family.students.map((student, index) => (
          <Card key={index} className="mt-4 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor={`student-first-name-${index}`}>First Name</Label>
                <Input
                  id={`student-first-name-${index}`}
                  type="text"
                  value={student.firstName}
                  onChange={(e) => updateStudent(index, { firstName: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`student-last-name-${index}`}>Last Name</Label>
                <Input
                  id={`student-last-name-${index}`}
                  type="text"
                  value={student.lastName}
                  onChange={(e) => updateStudent(index, { lastName: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`student-birth-date-${index}`}>Birth Date</Label>
                <Input
                  id={`student-birth-date-${index}`}
                  type="date"
                  value={student.birthDate}
                  onChange={(e) => updateStudent(index, { birthDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`student-belt-rank-${index}`}>Belt Rank</Label>
                <Select
                  value={student.beltRank}
                  onValueChange={(value) => updateStudent(index, { beltRank: value })}
                >
                  <SelectTrigger id={`student-belt-rank-${index}`}>
                    <SelectValue placeholder="Select belt rank" />
                  </SelectTrigger>
                  <SelectContent>
                    {BELT_RANKS.map((rank) => (
                      <SelectItem key={rank} value={rank} className="capitalize">
                        {rank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`student-gender-${index}`}>Gender</Label>
                <Select
                  value={student.gender}
                  onValueChange={(value) => updateStudent(index, { gender: value })}
                >
                  <SelectTrigger id={`student-gender-${index}`}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`student-school-${index}`}>School</Label>
                <Input
                  id={`student-school-${index}`}
                  type="text"
                  value={student.school}
                  onChange={(e) => updateStudent(index, { school: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`student-grade-level-${index}`}>Grade Level</Label>
                <Input
                  id={`student-grade-level-${index}`}
                  type="text"
                  value={student.gradeLevel}
                  onChange={(e) => updateStudent(index, { gradeLevel: e.target.value })}
                />
              </div>
            </div>
          </Card>
        ))}
        <Button 
          type="button" 
          onClick={addStudent}
          variant="outline"
          className="mt-2"
        >
          Add Student
        </Button>
      </div>
      
      <div className="flex justify-between">
        <Button
          type="button"
          onClick={saveFamily}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Family'}
        </Button>
        
        {family.id && (
          <Form method="post" action="/api/create-checkout-session">
            <input type="hidden" name="familyId" value={family.id} />
            <input type="hidden" name="amount" value="9900" />
            <input type="hidden" name="studentIds" 
                  value={JSON.stringify(family.students.map(s => s.id))} />
                  
            <Button
              type="submit"
              variant="default"
              className="bg-green-600 hover:bg-green-700"
            >
              Pay Registration Fee ($99)
            </Button>
          </Form>
        )}
      </div>
    </div>
  );
}
