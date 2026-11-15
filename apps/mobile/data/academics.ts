// Academic options for the student signup form (DOrSU official programs).
//
// The form used to list faculties under "Program", which stored a faculty name
// where the database expects the student's degree program. This grouped list
// keeps the faculty visible for navigation while the selected value is the
// program itself.

export type ProgramGroup = {
  faculty: string;
  programs: readonly string[];
};

export const DORSU_PROGRAM_GROUPS: readonly ProgramGroup[] = [
  {
    faculty: 'Faculty of Agriculture and Life Sciences',
    programs: [
      'BS Agribusiness Management',
      'BS Agriculture major in Animal Science',
      'BS Agriculture major in Crop Science',
      'BS Agriculture major in Horticulture',
      'BS Biology major in Animal Biology',
      'BS Biology major in Ecology',
      'BS Environmental Science',
    ],
  },
  {
    faculty: 'Faculty of Governance, Business and Management',
    programs: [
      'BS Business Administration major in Financial Management',
      'BS Hospitality Management',
    ],
  },
  {
    faculty: 'Faculty of Computing, Data Sciences, Engineering and Technology',
    programs: [
      'BS Information Technology',
      'BS Civil Engineering',
      'BS Mathematics',
      'BS Mathematics with Research Statistics',
      'Bachelor in Industrial Technology Management major in Automotive Technology',
    ],
  },
  {
    faculty: 'Faculty of Teacher Education',
    programs: [
      'Bachelor of Elementary Education',
      'Bachelor of Early Childhood Education',
      'Bachelor of Special Needs Education',
      'Bachelor of Physical Education',
      'Bachelor of Technology and Livelihood Education major in Home Economics',
      'Bachelor of Technology and Livelihood Education major in Industrial Arts',
      'Bachelor of Secondary Education major in English',
      'Bachelor of Secondary Education major in Filipino',
      'Bachelor of Secondary Education major in Mathematics',
      'Bachelor of Secondary Education major in Science',
    ],
  },
  {
    faculty: 'Faculty of Nursing and Allied Health Sciences',
    programs: ['BS Nursing'],
  },
  {
    faculty: 'Faculty of Criminal Justice Education',
    programs: ['BS Criminology'],
  },
  {
    faculty: 'Faculty of Humanities, Social Sciences and Communication',
    programs: [
      'BA major in Political Science',
      'BS Psychology',
      'BS Development Communication',
    ],
  },
] as const;

export const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year'] as const;
