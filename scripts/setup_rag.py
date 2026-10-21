# pip install langchain langchain-community sentence-transformers chromadb

from langchain_community.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

# 1. Load your documents
loader_mudawana = TextLoader("mudawana.txt", encoding="utf-8")
loader_guide = TextLoader("guide.txt", encoding="utf-8")
docs = loader_mudawana.load() + loader_guide.load()

# 2. Chunk the documents (Crucial for legal texts to keep articles together)
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000, 
    chunk_overlap=200, # Overlap prevents cutting sentences in half
    separators=["\n\nArticle", "\n\n", "\n", " ", ""]
)
chunks = text_splitter.split_documents(docs)

print(f"Split documents into {len(chunks)} chunks.")

# 3. Create the Vector Database (Using free, open-source embeddings)
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
vector_db = Chroma.from_documents(chunks, embeddings, persist_directory="./chroma_db")

# 4. Query the RAG system
retriever = vector_db.as_retriever(search_kwargs={"k": 3}) # Get top 3 most relevant chunks
query = "What are the conditions for divorce under the Mudawana?"
relevant_chunks = retriever.invoke(query)

print("\n--- Top Retrieved Context ---")
for i, chunk in enumerate(relevant_chunks):
    print(f"\nChunk {i+1}:\n{chunk.page_content}")