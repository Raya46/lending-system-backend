import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx'; // Import the xlsx library
import fs from 'fs';     // Import Node.js's built-in file system module to delete files


const router = express.Router();

// Configure Multer to store uploaded files in a temporary directory
const upload = multer({ dest: 'uploads/' });

/* Define the route for uploading student data from Excel
'studentFile' is the name of the form field the frontend will use to send the file*/
router.post('/upload', upload.single('studentFile'), (req, res) => {

    console.log('File uploaded:', req.file);

    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    // Get the path of the uploaded file from Multer
    const filePath = req.file.path;
    try {
    const workbook = xlsx.readFile(filePath);
        // Get the name of the very first sheet in the Excel file
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // --- NEW LOGIC ---
        // 1. Parse the sheet into an array of arrays, NOT an array of objects.
        // `header: 1` tells the library to treat every row as a simple array of its cell values.
        
        /*
        output dari rawData akan seperti ini:
        [
            // col 0      col 1
            [ 'NIM',      'Nama' ],           // This is row 0
            [ 2403421037, 'Ahmad Afif' ],     // This is row 1
            [ 2403421046, 'Astuti' ]          // This is row 2
        ] 
        */

        const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        // --- LOGIC TO FIND AND EXTRACT STUDENT DATA ---
        let headerRowIndex = -1;
        let nimColIndex = -1;
        let nameColIndex = -1;
        const studentData = [];
        
        // 2. Find the header row and the column indexes for NIM and Name
        for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            const nimIndex = row.findIndex(cell => typeof cell === 'string' && cell.toUpperCase().includes('NIM'));
            const nameIndex = row.findIndex(cell => typeof cell === 'string' && cell.toUpperCase().includes('NAMA'));

            // If we found both "NIM" and "NAMA" in the same row, this is our header row!
            if (nimIndex !== -1 && nameIndex !== -1) {
                headerRowIndex = i;
                nimColIndex = nimIndex;
                nameColIndex = nameIndex;
                break; // Stop searching once we've found it
            }
        }
        
        // 3. If we found the header row, extract the student data from the rows below it
        if (headerRowIndex !== -1) {
            for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                const row = rawData[i];
                
                // Get the potential NIM and Name from the correct columns we identified
                const nim = row[nimColIndex];
                const name = row[nameColIndex];

                // A simple check to see if this is a valid student row.
                if (typeof nim === 'number' && typeof name === 'string' && name.trim() !== '') {
                    studentData.push({

                        // The "No." is usually in the column to the left of NIM.
                        no: row[nimColIndex - 1],
                        nim: nim,
                        name: name
                    });
                }
            }
        }

        // --- End of new logic ---
    // 6. Send a success response back to the client with a preview
    res.status(200).json({
        message: 'file processed successfully',
        fileName: req.file.originalname,
        SheetNames: firstSheetName,
        studentsFound: studentData.length,
        students: studentData
    });

    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).send('An error occurred while processing the file.');
    } finally {
        // --- CLEANUP ---
        // It's very important to delete the temporary file after we're done with it.
        try {
            fs.unlinkSync(filePath);
            console.log(`Temporary file deleted: ${filePath}`);
        } catch (unlinkError) {
            console.error('Error deleting temporary file:', unlinkError);
        }
    }
});

export default router;