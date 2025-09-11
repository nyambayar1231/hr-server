import { Injectable } from '@nestjs/common';
import crypto from 'crypto';
import { Pool } from 'pg';
import { Document, DocumentInterface } from '@langchain/core/documents';
import { VectorStore } from '@langchain/core/vectorstores';
import { QueryClassifierService } from './query-classifier.service';
import { ConfigurationService } from '../config/configuration.service';

export interface Employee {
  name: string;
  'phone_no.': number;
  salary_mnt: number;
  enrolled_date: number;
  total_years_of_employment: number;
  number_of_months_paid_social_health_insurance_shi: number;
  number_of_years_worked: number;
  annual_leave_days_entitled: number;
  number_of_days_taken_from_entitled_annual_leave: number;
  number_of_days_remaining_from_annual_leave_entitlement: number;
  most_recent_promotion_year: number;
  number_of_year_since_last_promotion: number;
  position: string;
  role: string;
  gender: string;
  education_level: string;
  degree: string;
  department: string;
  language_1: string;
  language_2: string;
  language_3: string;
  bonus_in_2024: number;
  expected_bonus_in_2025: number;
  email: string;
  empid: number;
  employee_first_name: string;
  employee_last_name: string;
  level: number;
  company: string;
  learning_ability_2025_9_box: string;
  career_aspiration_2025_9_box: string;
  individual_potential_2025_9_box: string;
  individual_potential_assessment_2025_9_box: string;
  performance_appraisal_2025_9_box: string;
  '9_box_position_2025_9_box': string;
  evaluating_direct_manager_2025_9_box: string;
  evaluation_date_2025_9_box: number;
  evaluation_year_2025_9_box: number;
  risk_of_resignation_attrition_risk_2025_9_box: string;
  'required_attendance_first_half_of_september,_2025': number;
  'actual_attendance_first_half_of_september,_2025': number;
  'gap_in_attendance,_need_to_calirfy_with_employee': number;
}

interface SecureEmployee {
  employee_hash: string;
  employee_role: string;
  encrypted_email: string;
  encrypted_salary: string;
}

interface EmployeeMetadata {
  employeeHash: string;
  type: string;
}

type EmployeeDoc = DocumentInterface<EmployeeMetadata>;

@Injectable()
export class EmployeeService {
  private encryptionKey: string;
  private pool: Pool;

  constructor(
    private configService: ConfigurationService,
    private queryClassifier: QueryClassifierService,
  ) {
    this.encryptionKey = process.env.EMPLOYEE_ENCRYPTION_KEY!;
    this.pool = new Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'hr_help_desk',
    });
  }

  // protects salary + email
  async ingestSecureEmployees(employees: Employee[]): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE secure_employees');

      for (const employee of employees) {
        const employeeHash = this.createEmailHash(employee.email);

        await client.query(
          `
          INSERT INTO secure_employees (
            employee_hash,
            employee_role,
            encrypted_email, 
            encrypted_salary
          ) VALUES ($1, $2, $3, $4)
        `,
          [
            employeeHash,
            employee.role,
            this.encrypt(employee.email),
            this.encrypt(employee.salary_mnt.toString()),
          ],
        );
      }

      await client.query('COMMIT');
      console.log(`Securely ingested ${employees.length} employees`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // get personal documents
  async getPersonalDocument(
    requestingUserEmail: string,
    vectorStore: VectorStore,
  ): Promise<Document | null> {
    try {
      const requestingUserHash = this.createEmailHash(requestingUserEmail);

      const secureEmployees = await this.getSecureEmployeeData([
        requestingUserHash,
      ]);
      const secureUser = secureEmployees?.[0];

      if (!secureUser) {
        console.log(`No employee data found for hash: ${requestingUserHash}`);
        return null;
      }

      const personalDocs = await vectorStore.similaritySearch('', 10, {
        employeeHash: requestingUserHash, // Only the current employee
      });

      return new Document({
        pageContent: this.buildFullPersonalContent(secureUser, personalDocs),
        metadata: {
          employeeHash: requestingUserHash,
          type: 'personal',
          isOwnData: true,
          hasPersonalInfo: true,
        },
      });
    } catch (error) {
      console.error(
        'Error retrieving personal document for user:',
        requestingUserEmail,
        error,
      );
      return null;
    }
  }

  private buildFullPersonalContent(
    secureEmployee: SecureEmployee,
    vectorDocs: Document[],
  ): string {
    const parts: string[] = [];

    // Sensitive info
    const decryptedSalary = Number(
      this.decrypt(secureEmployee.encrypted_salary),
    );
    const formattedSalary = new Intl.NumberFormat('mn-MN', {
      style: 'currency',
      currency: 'MNT',
      minimumFractionDigits: 0,
    }).format(decryptedSalary);

    parts.push(`Email: ${this.decrypt(secureEmployee.encrypted_email)}`);
    parts.push(`Salary: ${formattedSalary}`);

    // Add vector store docs
    for (const doc of vectorDocs) {
      parts.push(doc.pageContent);
    }

    return parts.join(' | ');
  }

  // Get employee documents from vectore store
  async getEmployeeDocuments(
    searchQuery: string,
    requestingUserEmail: string,
    vectorStore: VectorStore,
    k: number = 5,
  ): Promise<Document[]> {
    try {
      const lowerQuestion = searchQuery.toLowerCase().trim();

      const vectorResults = await vectorStore.similaritySearch(
        lowerQuestion,
        k * 2,
        { type: 'employee' },
      );

      if (vectorResults.length === 0) return [];

      const employeeHashes = vectorResults.map(
        (doc: EmployeeDoc) => doc.metadata.employeeHash,
      );

      const secureEmployees = await this.getSecureEmployeeData(employeeHashes);
      const requestingUserHash = this.createEmailHash(requestingUserEmail);

      const results: Document[] = vectorResults
        .map((vectorDoc: EmployeeDoc) => {
          const employeeHash = vectorDoc.metadata.employeeHash;
          const secureData = secureEmployees.find(
            (emp) => emp.employee_hash === employeeHash,
          );
          if (!secureData) return null;

          const isOwnData = employeeHash === requestingUserHash;
          const content = this.buildSecureContent(
            secureData,
            vectorDoc,
            isOwnData,
          );

          return new Document({
            pageContent: content,
            metadata: {
              ...vectorDoc.metadata,
              isOwnData,
              hasPersonalInfo: isOwnData,
            },
          });
        })
        .filter(Boolean) as Document[];

      return results.slice(0, k);
    } catch (error) {
      console.error('Error retrieving employee data', error);
      return [];
    }
  }

  private buildSecureContent(
    secureEmployee: SecureEmployee,
    vectorDoc: Document,
    isOwnData: boolean,
  ): string {
    const parts: string[] = [];

    if (vectorDoc.pageContent) {
      parts.push(vectorDoc.pageContent);
    }

    // Only add sensitive data if it's the user's own record
    if (isOwnData) {
      const decryptedSalary = Number(
        this.decrypt(secureEmployee.encrypted_salary),
      );
      const formattedSalary = new Intl.NumberFormat('mn-MN', {
        style: 'currency',
        currency: 'MNT',
        minimumFractionDigits: 0,
      }).format(decryptedSalary);

      parts.push(`Email: ${this.decrypt(secureEmployee.encrypted_email)}`);
      parts.push(`Salary: ${formattedSalary}`);
    }

    return parts.join(' | ');
  }

  async getSecureEmployeeData(
    employeeHashes: string[],
  ): Promise<SecureEmployee[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
        SELECT employee_hash, employee_role, encrypted_email, encrypted_salary
        FROM secure_employees 
        WHERE employee_hash = ANY($1)
      `,
        [employeeHashes],
      );

      return result.rows as SecureEmployee[];
    } finally {
      client.release();
    }
  }

  // 11. ENCRYPTION HELPERS
  private encrypt(text: string): string {
    const algorithm = 'aes-256-cbc';
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-cbc';
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  createEmailHash(email: string): string {
    return crypto
      .createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest('hex');
  }

  private convertExcelDate(excelDate: string | number): string {
    const excelEpoch = new Date(1900, 0, 1);
    const serialNumber =
      typeof excelDate === 'string' ? parseFloat(excelDate) : excelDate;

    // Convert Excel serial date to JavaScript Date
    const jsDate = new Date(
      excelEpoch.getTime() + (serialNumber - 2) * 24 * 60 * 60 * 1000,
    );

    // Return in YYYY-MM-DD format for PostgreSQL
    return jsDate.toISOString().split('T')[0];
  }
}
