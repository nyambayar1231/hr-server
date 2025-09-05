import XLSX from 'xlsx';
import { Document } from '@langchain/core/documents';
import dotenv from 'dotenv';
import path from 'path';
import { createVectorStoreInstance } from '../utils/vector-store-utils';
dotenv.config();

interface Employee {
  Name: string;
  ' Salary ': number;
  Enrolled_Date: string;
  Total_Years_of_Employment: number;
  Position: string;
  Department: string;
  Email: string;
}

export async function ingestEmployeeData() {
  try {
    // Determine the correct path based on whether we're running from dist or src
    const isProduction = __dirname.includes('dist');
    const employeeFilePath = isProduction
      ? path.join(__dirname, '../../src/data/employees/employee_data.xlsx')
      : path.join(__dirname, '../data/employees/employee_data.xlsx');

    const workbook = XLSX.readFile(employeeFilePath);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const employees = XLSX.utils.sheet_to_json(
      workbook.Sheets['Employees'],
    ) as Employee[];

    const documents: Document[] = [];

    for (const row of employees) {
      const content = `Name: ${row.Name} | Salary: ${row[' Salary ']} | Enrolled_Date: ${row.Enrolled_Date} | Total_Years_of_Employment: ${row.Total_Years_of_Employment} | Position: ${row.Position} | Department: ${row.Department} | Email: ${row.Email}`;

      documents.push({
        pageContent: content,
        metadata: {
          type: 'personal',
          email: row.Email,
        },
      });
    }

    const vectorStore = await createVectorStoreInstance();
    await vectorStore.addDocuments(documents);
    console.log(
      `Successfully ingested ${documents.length} employee documents.`,
    );
  } catch (error) {
    console.error('Error ingesting employee data:', error);
  }
}

ingestEmployeeData();
