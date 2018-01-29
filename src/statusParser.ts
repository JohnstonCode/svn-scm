import * as xml2js from "xml2js";
import { camelcase } from "./util";

export interface IFileStatus {
  status: string;
  props: string;
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
  path: string;
  wcStatus: {
    item: string;
    revision: string;
    props: string;
    movedTo?: string;
    movedFrom?: string;
    wcLocked?: string;
    commit: {
      revision: string;
      author: string;
      date: string;
    };
  };
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
    path: entry.path,
    status: entry.wcStatus.item,
    props: entry.wcStatus.props
  };

  if (entry.wcStatus.movedTo && r.status === "deleted") {
    return [];
  }
  if (entry.wcStatus.movedFrom && r.status === "added") {
    r.rename = entry.wcStatus.movedFrom;
  }
  if (entry.wcStatus.commit) {
    r.commit = {
      revision: entry.wcStatus.commit.revision,
      author: entry.wcStatus.commit.author,
      date: entry.wcStatus.commit.date
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
      statusList.push(...processEntry(change.entry, change.name));
    });
  }

  return statusList;
}

export async function parseStatusXml(content: string): Promise<IFileStatus[]> {
  return new Promise<IFileStatus[]>((resolve, reject) => {
    xml2js.parseString(
      content,
      {
        mergeAttrs: true,
        explicitRoot: false,
        explicitArray: false,
        attrNameProcessors: [camelcase],
        tagNameProcessors: [camelcase]
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
