import mondaySdk from "monday-sdk-js";

const monday = mondaySdk();

export async function createBoard(workspaceId, boardName) {
  console.log('workspaceId',workspaceId)
  let mutation = `mutation create_board($boardName: String!, $workspaceId: ID) {
    create_board(board_name:$boardName, board_kind:public, workspace_id:$workspaceId) {
        id
    }
}`;
  const variables = { boardName, workspaceId: Number(workspaceId) };
  return monday.api(mutation, { variables })
    .then((res) => {
      console.log('res',res);
      return res.data.create_board.id;
    })
    .catch(err => console.log('err', err));
}

export async function createColumn(boardId, columnTitle, columnType) {
  let mutation = `mutation create_column($boardId: ID!, $columnTitle: String!, $columnType: ColumnType!) {
    create_column(board_id:$boardId, title:$columnTitle, column_type:$columnType) {
        id
    }
}`;
  const variables = { boardId: Number(boardId),  columnTitle, columnType};
  return monday.api(mutation, { variables })
    .then((res) => {
      console.log('res',res);
      return res.data.create_column.id;
    })
    .catch(err => console.log('err', err));
}

export async function createItem(boardId, columnValues, name) {
  const mutation = `mutation create_item($boardId: ID!, $itemName: String!, $columnValues: JSON) {
    create_item(board_id:$boardId, item_name:$itemName, column_values:$columnValues, create_labels_if_missing: true) {
        id
    }
}`;
  const variables = { boardId: Number(boardId), itemName: `${name}`, columnValues: JSON.stringify(columnValues) };
  const response = await monday.api(mutation, { variables })
  return response.data.create_item.id;
}

export async function connectDependency(itemId, boardId, dependencyId) {
  const mutation = `mutation change_multiple_column_values($boardId: ID!, $itemId: ID, $columnValues: JSON!) {
    change_multiple_column_values(board_id:$boardId, item_id:$itemId, column_values:$columnValues) {
        id
    }
}`;
  const variables = { boardId: Number(boardId), itemId, columnValues: JSON.stringify({predecessors_: {item_ids: [dependencyId]}})};
  const response = await monday.api(mutation, { variables })
  console.log('response', response);
  return response.data.change_multiple_column_values.id;
}