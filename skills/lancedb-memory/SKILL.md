---
name: lancedb-memory
description: lancedb-memory skill
description_zh: lancedb-memory skill
---
#!/usr/bin/env python3
"""
LanceDB 集成，用于长期记忆管理。
提供向量搜索与语义记忆能力。
"""

import os
import json
import lancedb
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

class LanceMemoryDB:
    """用于长期记忆存储与检索的 LanceDB 封装类。"""
    
    def __init__(self, db_path: str = "/Users/prerak/clawd/memory/lancedb"):
        self.db_path = Path(db_path)
        self.db_path.mkdir(parents=True, exist_ok=True)
        self.db = lancedb.connect(self.db_path)
        
        # 确保 memory 表存在
        if "memory" not in self.db.table_names():
            self._create_memory_table()
    
    def _create_memory_table(self):
        """按适当 schema 创建 memory 表。"""
        schema = [
            {"name": "id", "type": "int", "nullable": False},
            {"name": "timestamp", "type": "timestamp", "nullable": False},
            {"name": "content", "type": "str", "nullable": False},
            {"name": "category", "type": "str", "nullable": True},
            {"name": "tags", "type": "str[]", "nullable": True},
            {"name": "importance", "type": "int", "nullable": True},
            {"name": "metadata", "type": "json", "nullable": True},
        ]
        
        self.db.create_table("memory", schema=schema)
    
    def add_memory(self, content: str, category: str = "general", tags: List[str] = None, 
                   importance: int = 5, metadata: Dict[str, Any] = None) -> int:
        """添加一条新记忆条目。"""
        table = self.db.open_table("memory")
        
        # 获取下一个 ID
        max_id = table.to_pandas()["id"].max() if len(table) > 0 else 0
        new_id = max_id + 1
        
        # 插入新记忆
        memory_data = {
            "id": new_id,
            "timestamp": datetime.now(),
            "content": content,
            "category": category,
            "tags": tags or [],
            "importance": importance,
            "metadata": metadata or {}
        }
        
        table.add([memory_data])
        return new_id
    
    def search_memories(self, query: str, category: str = None, limit: int = 10) -> List[Dict]:
        """使用向量相似度搜索记忆。"""
        table = self.db.open_table("memory")
        
        # 构建过滤条件
        where_clause = []
        if category:
            where_clause.append(f"category = '{category}'")
        
        filter_expr = " AND ".join(where_clause) if where_clause else None
        
        # 向量搜索
        results = table.vector_search(query).limit(limit).where(filter_expr).to_list()
        
        return results
    
    def get_memories_by_category(self, category: str, limit: int = 50) -> List[Dict]:
        """按分类获取记忆。"""
        table = self.db.open_table("memory")
        df = table.to_pandas()
        filtered = df[df["category"] == category].head(limit)
        return filtered.to_dict("records")
    
    def get_memory_by_id(self, memory_id: int) -> Optional[Dict]:
        """根据 ID 获取特定记忆。"""
        table = self.db.open_table("memory")
        df = table.to_pandas()
        result = df[df["id"] == memory_id]
        return result.to_dict("records")[0] if len(result) > 0 else None
    
    def update_memory(self, memory_id: int, **kwargs) -> bool:
        """更新某条记忆条目。"""
        table = self.db.open_table("memory")
        
        valid_fields = ["content", "category", "tags", "importance", "metadata"]
        updates = {k: v for k, v in kwargs.items() if k in valid_fields}
        
        if not updates:
            return False
        
        # 转换为 LanceDB 所需类型
        if "tags" in updates and isinstance(updates["tags"], list):
            updates["tags"] = str(updates["tags"]).replace("'", '"')
        
        table.update(updates, where=f"id = {memory_id}")
        return True
    
    def delete_memory(self, memory_id: int) -> bool:
        """删除某条记忆条目。"""
        table = self.db.open_table("memory")
        current_count = len(table)
        table.delete(f"id = {memory_id}")
        return len(table) < current_count
    
    def get_all_categories(self) -> List[str]:
        """获取所有唯一分类。"""
        table = self.db.open_table("memory")
        df = table.to_pandas()
        return df["category"].dropna().unique().tolist()
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """获取记忆存储统计信息。"""
        table = self.db.open_table("memory")
        df = table.to_pandas()
        
        return {
            "total_memories": len(df),
            "categories": len(self.get_all_categories()),
            "by_category": df["category"].value_counts().to_dict(),
            "date_range": {
                "earliest": df["timestamp"].min().isoformat() if len(df) > 0 else None,
                "latest": df["timestamp"].max().isoformat() if len(df) > 0 else None
            }
        }

# 全局实例
lancedb_memory = LanceMemoryDB()

def add_memory(content: str, category: str = "general", tags: List[str] = None, 
               importance: int = 5, metadata: Dict[str, Any] = None) -> int:
    """将记忆添加至 LanceDB 存储。"""
    return lancedb_memory.add_memory(content, category, tags, importance, metadata)

def search_memories(query: str, category: str = None, limit: int = 10) -> List[Dict]:
    """使用语义相似度搜索记忆。"""
    return lancedb_memory.search_memories(query, category, limit)

def get_memories_by_category(category: str, limit: int = 50) -> List[Dict]:
    """按分类获取记忆。"""
    return lancedb_memory.get_memories_by_category(category, limit)

def get_memory_stats() -> Dict[str, Any]:
    """获取记忆存储统计信息。"""
    return lancedb_memory.get_memory_stats()

# 示例用法
if __name__ == "__main__":
    # 测试数据库
    print("正在测试 LanceDB 记忆集成...")
    
    # 添加一条测试记忆
    test_id = add_memory(
        content="这是用于 LanceDB 集成的一条测试记忆",
        category="test",
        tags=["lancedb", "integration", "test"],
        importance=8
    )
    print(f"已添加 ID 为 {test_id} 的记忆")
    
    # 搜索记忆
    results = search_memories("test memory")
    print(f"搜索结果：共找到 {len(results)} 条记忆")
    
    # 获取统计信息
    stats = get_memory_stats()
    print(f"记忆统计：{stats}")