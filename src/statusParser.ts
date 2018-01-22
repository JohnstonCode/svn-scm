import * as xml2js from "xml2js";

export interface IFileStatus {
  status: string;
  path: string;
  changelist?: string;
  rename?: string;
  commit?: {
    revision: string;
    author: string;
    date: string;
  };
  [key: number]: IFileStatus;
}

export interface IEntry {
  $: {
    path: string;
  };
  "wc-status": {
    $: {
      item: string;
      revision: string;
      props: string;
      "moved-to"?: string;
      "moved-from"?: string;
    };
    commit: {
      $: {
        revision: string;
      };
      author: string;
      date: string;
    };
  };
  path: string;
  rename?: string;
}

function processEntry(
  entry: IEntry | IEntry[],
  changelist?: string
): IFileStatus[] {
  if (Array.isArray(entry)) {
    let list: IFileStatus[] = [];
    entry.forEach((e: any) => {
      const r = processEntry(e, changelist);
      if (r) {
        list.push(...r);
      }
    });
    return list;
  }

  let r: IFileStatus = {
    changelist: changelist,
    path: entry["$"].path,
    status: entry["wc-status"].$.item
  };

  if (entry["wc-status"].$["moved-to"] && r.status === "deleted") {
    return [];
  }
  if (entry["wc-status"].$["moved-from"] && r.status === "added") {
    r.rename = entry["wc-status"].$["moved-from"];
  }
  if (entry["wc-status"].commit) {
    r.commit = {
      revision: entry["wc-status"].commit.$.revision,
      author: entry["wc-status"].commit.author,
      date: entry["wc-status"].commit.date
    };
  }

  return [r];
}

function xmlToStatus(xml: any) {
  const statusList: IFileStatus[] = [];
  if (xml.target && xml.target.entry) {
    statusList.push(...processEntry(xml.target.entry));
  }

  if (xml.changelist) {
    if (!Array.isArray(xml.changelist)) {
      xml.changelist = [xml.changelist];
    }

    xml.changelist.forEach((change: any) => {
      statusList.push(...processEntry(change.entry, change.$.name));
    });
  }

  return statusList;
}

export async function parseStatusXml(content: string): Promise<IFileStatus[]> {
  return new Promise<IFileStatus[]>((resolve, reject) => {
    xml2js.parseString(
      content,
      {
        explicitRoot: false,
        explicitArray: false
      },
      (err, result) => {
        if (err) {
          reject();
        }

        const statusList: IFileStatus[] = xmlToStatus(result);

        resolve(statusList);
      }
    );
  });
}
