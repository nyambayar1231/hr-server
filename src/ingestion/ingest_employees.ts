import XLSX from 'xlsx';
import { Document } from '@langchain/core/documents';
import { vectorStore } from '../pg';
import dotenv from 'dotenv';
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

const excelFilePath = '../data/employees/employee_data.xlsx';

export async function ingestEmployeeData() {
  try {
    const workbook = XLSX.readFile(excelFilePath);
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

    // Await the addition of all documents
    await vectorStore.addDocuments(documents);
    console.log(
      `Successfully ingested ${documents.length} employee documents.`,
    );
  } catch (error) {
    console.error('Error ingesting employee data:', error);
  }
}

ingestEmployeeData();
