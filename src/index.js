import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useDropzone } from "react-dropzone";
import * as XLSX from 'xlsx'
import { Button } from "monday-ui-react-core";
import { createBoard, createColumn, createItem, connectDependency } from './utils.js';
import mondaySdk from "monday-sdk-js";
import { Promise } from "bluebird";
import _ from 'lodash';
import "./styles.css";
import "monday-ui-react-core/dist/main.css"

function App(props) {

  const monday = mondaySdk();
  const [workspaceId, setWorkspaceId] = useState(0);
  const [stateLogger, setStateLogger] = useState('');
  const [headers, setHeaders] = useState([]);
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const { acceptedFiles, getRootProps, getInputProps } = useDropzone();

  useEffect(() => {
    monday.listen('context', res => {
      console.log('Workspace ID', res.data.workspaceId);
      setWorkspaceId(res.data.workspaceId);
    })
  }, [])

  async function runMigration() {
    fileToArray();
  }

  function transformRowToColumnValues(row, mapping) {
    console.log('row', row);
    const cv = {};
    for (let i = 0; i < row.length; i++) {
      if (!!row[i] && !!mapping[i].id) {
        switch (mapping[i].type) {
          case 'numbers':
            cv[mapping[i].id] = row[i];
            break;
          case 'text':
            cv[mapping[i].id] = row[i];
            break;
          case 'long_text':
            cv[mapping[i].id] = row[i];
            break;
          case 'date':
            cv[mapping[i].id] = { 'date': row[i].toISOString().split('T')[0] }
            break;
          case 'link':
            cv[mapping[i].id] = { 'url': row[i], 'text': row[i] }
            break;
          case 'status':
            cv[mapping[i].id] = { 'label': row[i] };
            break;
        }
      }
    }
    return cv;
  }

  async function createAllItems(data, mapping, boardId) {
    let dependencies = [];
    let item_ids = [];
    for (let i = 0; i < data.length; i++) {
      if (data[i].length > 0) {
        let columnValues = transformRowToColumnValues(data[i], mapping)
        console.log('column values', columnValues);
        let name = data[i][_.find(mapping, value => value.type === 'name').index]
        let dependency_id = data[i][_.find(mapping, value => value.type === 'dependency').index];
        console.log('depdendency id', dependency_id);
        setStateLogger(`Creating item ${i+1}/${data.length}: ${name}`)
        let id = await createItem(boardId, columnValues, name);
        item_ids[i] = id;
        if (!!dependency_id) {
          dependencies[i] = { id, dependency_id };
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    return {dependencies, item_ids};
  }

  async function connectDependencies(dependencies, item_ids, board_id) {
    console.log('dependencies', dependencies);
    console.log('item_ids', item_ids);
    for (let i = 0; i < dependencies.length; i++) {
      if (!!dependencies[i]) {
        const regexp = /([0-9]*).*/;
        let dep_number = dependencies[i].dependency_id;
        if(typeof dependencies[i].dependency_id === 'string') {
        const matches = dependencies[i].dependency_id.match(regexp)
        dep_number = Number(matches[1]);
        }
        const dependency_id = item_ids[dep_number - 2];
        console.log('id, dependency_id', dependencies[i].id, dependency_id);
        await connectDependency(dependencies[i].id, board_id, dependency_id)
        setStateLogger(`Connecting dependencies ${i+1}/${dependencies.length}`)
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  async function createColumns(boardId, headers) {
    console.log('boardId', boardId);
    const mapping = [];
    for (let i = 0; i < headers.length; i++) {
      console.log('header', headers[i]);
      const regexp = /(.*)\[(.*)\]/;
      const matches = headers[i].match(regexp)
      console.log('matches', matches);
      if (matches) {
        let column_id = null;
        switch (matches[2]) {
          case 'NUMBERS':
            column_id = await createColumn(boardId, matches[1], 'numbers');
            mapping.push({ id: column_id, index: i, type: 'numbers' });
            break;
          case 'DATE':
            column_id = await createColumn(boardId, matches[1], 'date');
            mapping.push({ id: column_id, index: i, type: 'date' });
            break;
          case 'DEPENDENCY':
            column_id = await createColumn(boardId, matches[1], 'dependency');
            mapping.push({ id: column_id, index: i, type: 'dependency' });
            break;
          case 'TEXT':
            column_id = await createColumn(boardId, matches[1], 'text');
            mapping.push({ id: column_id, index: i, type: 'text' });
            break;
          case 'LONGTEXT':
            column_id = await createColumn(boardId, matches[1], 'long_text');
            mapping.push({ id: column_id, index: i, type: 'long_text' });
            break;
          case 'LINK':
            column_id = await createColumn(boardId, matches[1], 'link');
            mapping.push({ id: column_id, index: i, type: 'link' });
            break;
          case 'STATUS':
            column_id = await createColumn(boardId, matches[1], 'status');
            mapping.push({ id: column_id, index: i, type: 'status' });
            break;
          case 'NAME':
            // column_id = await createColumn(boardId, matches[1], 'name');
            mapping.push({ id: 'name', index: i, type: 'name' });
            break;
          default:
            mapping.push({ id: null, index: i, type: null });
            break;
        }
      } else mapping.push({ id: null, index: i, type: null });
    }
    return mapping;
  }

  async function fileToArray() {
    console.log('accepted files', acceptedFiles);
    const reader = new FileReader();
    const rABS = !!reader.readAsBinaryString;
    let fileExt;

    reader.onabort = () => setError('File reading was aborted');
    reader.onerror = () => setError('File reading has failed');
    reader.onload = async (e) => {
      //** Parse XLSC */
      if (fileExt === 'xlsx') {
        const bstr = e.target.result;
        // const wb = XLSX.read(bstr, { type: rABS ? "binary" : "array" });
        const wb = await XLSX.read(bstr, { type: "binary", cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
        const headers = data.shift();
        console.log('headers', headers);
        console.log('data', data);
        setStateLogger("Creating Board...")
        const boardId = await createBoard(workspaceId, wsname)
        setStateLogger("Creating Columns...")
        const mapping = await createColumns(boardId, headers);

        const { dependencies, item_ids } = await createAllItems(_.filter(data, row => row.length > 0), mapping, boardId);
        await connectDependencies(dependencies, item_ids, boardId);
        setStateLogger(`All set! to view your board: https://getcruise.monday.com/boards/${boardId}`)
      }
    };

    //** Read files on upload */
    acceptedFiles.forEach(file => {
      fileExt = file.name.split('.').pop();
      if (fileExt === 'csv') reader.readAsText(file)
      else if (fileExt === 'xlsx') {
        if (rABS) reader.readAsBinaryString(file);
        else reader.readAsArrayBuffer(file);
      }
      else setError('Invalid file extension. Only .csv & .xlsx are supported.')
    });
  }


  const files = acceptedFiles.map(file => (
    <li key={file.path}>
      {file.path} - {file.size} bytes
    </li>
  ));

  return (
    <div className="App">
      <div {...getRootProps({ className: 'dropzone' })}>
        <input {...getInputProps()} />
        <p>Drag 'n' drop some files here, or click to select files</p>
      </div>
      <aside>
        <ul>{files}</ul>
      </aside>
      {acceptedFiles.length > 0 && <Button onClick={() => runMigration()}>Migrate</Button>}
      {<p>{stateLogger}</p>}
      {headers.length > 0 && <p>{JSON.stringify(headers)}</p>}
      {data.length > 0 && <p>{data[0][0]}</p>}
    </div>
  );
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
