import * as chai from 'chai';
import fs from 'fs';
import path from 'path';
import * as url from 'url';
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
import Worksheet from '../js/Worksheet.js';
import '../ap-sheet/src/APSheet.js';
const assert = chai.assert;
const should = chai.should;
const expect = chai.expect;

// File Setup
const exampleInput1 = fs.readFileSync(path.resolve(__dirname, "./sources/example1.csv")).toString();

describe("CSV Tests", () => {
    let worksheet;
    before(() => {
        worksheet = document.createElement('work-sheet');
        document.body.append(worksheet);
    });
    describe("CSV Writing Tests", () => {
        it("Worksheet element exists and has an ap-sheet ref", () => {
            assert.exists(worksheet);
            assert.exists(worksheet.sheet);
            assert.exists(worksheet.sheet.dataStore);
        });
        it("Can write CSV data", async () => {
            let data = await worksheet.toCSV();
            assert.exists(data);
            assert.isTrue(data.length > 0);
        });
        it("Can save CSV data to a temp file", async () => {
            let data = await worksheet.toCSV();
            let filename = path.resolve(__dirname, "./.tmp_ex_1.csv");
            let written = fs.writeFileSync(filename, data);
            assert.isTrue(fs.existsSync(filename));
        });
    });
    describe("CSV Reading Tests", () => {
        it("Can load a CSV from a file", () => {
            assert.exists(exampleInput1);
        });
        it("Can load the CSV data into the Worksheet", () => {
            let testFunc = () => {
                worksheet.fromCSV(exampleInput1);
            };
            expect(testFunc).to.not.throw();
        });
        it("Worksheet DataFrame has the expected values in the first row", async () => {
            let expected = [
                'Name',
                '     "Sex"',
                ' "Age"',
                ' "Height (in)"',
                ' "Weight (lbs)"'
            ];
            let dataStoreArray = await worksheet.sheet.dataStore.getDataArray([0, 0], [5, 5]);
            let result = dataStoreArray[0].slice(0, 5);
            expect(expected).to.eql(result);
        });

        it("First row of cells has expected text", () => {
            let expectedRow = [
                'Name',
                '     "Sex"',
                ' "Age"',
                ' "Height (in)"',
                ' "Weight (lbs)"'
            ].map(item => item.trim());
            expectedRow.forEach((expectedText, x) => {
                let element = worksheet.sheet.querySelector(
                    `sheet-cell[data-relative-x="${x}"][data-relative-y="0"]`
                );
                assert.exists(element);
                let result = element.innerText.trim();
                expect(expectedText).to.equal(result);
            });
        });
    });

    after(() => {
        worksheet.remove();
    });
});
