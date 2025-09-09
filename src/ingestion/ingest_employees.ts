import XLSX from 'xlsx';
import { Document } from '@langchain/core/documents';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { createVectorStoreInstance } from '../utils/vector-store-utils';
import { Employee, EmployeeService } from '../services/employee.service';
import { QueryClassifierService } from '../services/query-classifier.service';
import { ConfigurationService } from '../config/configuration.service';
import { ConfigService } from '@nestjs/config';
dotenv.config();

function normalizeKeys<T extends Record<string, any>>(
  row: T,
): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const cleanKey = key
      .trim()
      .replace(/\s+/g, '_') // replace spaces
      .replace(/[()?/]/g, '') // remove weird chars
      .replace(/_+/g, '_') // collapse multiple underscores
      .toLowerCase();
    normalized[cleanKey] = value as unknown;
  }
  return normalized as Record<string, unknown>;
}

const isProduction = __dirname.includes('dist');
const FILE_PATH = isProduction
  ? path.join(__dirname, '../../src/data/employees/employee_data.xlsx')
  : path.join(__dirname, '../data/employees/employee_data.xlsx');

const configService = new ConfigService();
const configurationService = new ConfigurationService(configService);
const queryClassifier = new QueryClassifierService(configurationService);

const employeesService = new EmployeeService(
  configurationService,
  queryClassifier,
);

export async function ingestEmployeeData(): Promise<void> {
  try {
    const workbook = XLSX.readFile(FILE_PATH);
    const raw = XLSX.utils.sheet_to_json<Record<string, any>>(
      workbook.Sheets['RAW'],
    );

    const employees = raw.map((row) => normalizeKeys(row)) as Employee[];

    const vectorStore = await createVectorStoreInstance();
    const searchableDocuments: Document[] = [];

    await employeesService.ingestSecureEmployees(employees);

    for (const employee of employees) {
      const employeeHash = crypto
        .createHash('sha256')
        .update(employee.email.toLowerCase().trim())
        .digest('hex');

      const baseMetadata = {
        type: 'employee',
        employeeHash,
        department: employee.department,
        position: employee.position,
        company: employee.company,
        level: employee.level,
      };

      // ------ Profile doc
      const profileContent = [
        `Name: ${employee.name}`,
        `Position: ${employee.position}`,
        `Department: ${employee.department}`,
        `Years of Employment: ${employee.total_years_of_employment}`,
        `Education Level: ${employee.education_level}`,
        `Degree: ${employee.degree}`,
        `Languages: ${[
          employee.language_1,
          employee.language_2,
          employee.language_3,
        ]
          .filter(Boolean)
          .join(', ')}`,
      ].join(' | ');

      searchableDocuments.push(
        new Document({
          pageContent: profileContent,
          metadata: {
            ...baseMetadata,
            category: 'profile',
          },
        }),
      );

      // ------ Leave & Attendance doc
      const leaveContent = [
        `Annual leave entitlement: ${employee.annual_leave_days_entitled}`,
        `Leave taken: ${employee.number_of_days_taken_from_entitled_annual_leave}`,
        `Leave remaining: ${employee.number_of_days_remaining_from_annual_leave_entitlement}`,
        `Required attendance (Sep 2025, first half): ${employee['required_attendance_first_half_of_september,_2025']}`,
        `Actual attendance (Sep 2025, first half): ${employee['actual_attendance_first_half_of_september,_2025']}`,
        `Attendance gap: ${employee['gap_in_attendance,_need_to_calirfy_with_employee']}`,
      ].join(' | ');

      searchableDocuments.push(
        new Document({
          pageContent: leaveContent,
          metadata: { ...baseMetadata, category: 'leave' },
        }),
      );

      // -- Performance doc
      const performanceContent = [
        `Performance appraisal (2025): ${employee.performance_appraisal_2025_9_box}`,
        `Learning ability: ${employee.learning_ability_2025_9_box}`,
        `Career aspiration: ${employee.career_aspiration_2025_9_box}`,
        `Individual potential: ${employee.individual_potential_2025_9_box}`,
        `Most recent promotion year: ${employee.most_recent_promotion_year}`,
        `Years since last promotion: ${employee.number_of_year_since_last_promotion}`,
        `Attrition risk: ${employee.risk_of_resignation_attrition_risk_2025_9_box}`,
      ].join(' | ');

      searchableDocuments.push(
        new Document({
          pageContent: performanceContent,
          metadata: { ...baseMetadata, category: 'performance' },
        }),
      );
    }

    if (searchableDocuments.length > 0) {
      await vectorStore.addDocuments(searchableDocuments);
      console.log(`Ingested ${searchableDocuments.length} employee docs`);
    }
  } catch (error) {
    console.error('Error ingesting employee data:', error);
  }
}
