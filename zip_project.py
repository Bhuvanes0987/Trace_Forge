import os
import zipfile

def zip_project(output_filename="enterprise_observability_platform.zip"):
    # Root directory of the project
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Exclude list to keep the ZIP clean and compact
    exclude_dirs = {
        "node_modules", 
        "__pycache__", 
        ".git", 
        ".env", 
        "venv", 
        ".gemini", 
        "observability.db",
        ".system_generated"
    }
    
    exclude_files = {
        output_filename,
        "zip_project.py"
    }

    print(f"Archiving workspace at {root_dir}...")
    
    zip_path = os.path.join(root_dir, output_filename)
    
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for folder_name, subfolders, filenames in os.walk(root_dir):
            # Prune excluded directories in-place to prevent os.walk from scanning them
            subfolders[:] = [d for d in subfolders if d not in exclude_dirs]
            
            for filename in filenames:
                if filename in exclude_files:
                    continue
                if filename.endswith(".pyc") or filename.endswith(".log"):
                    continue
                    
                file_path = os.path.join(folder_name, filename)
                # Compute relative path for ZIP structure
                rel_path = os.path.relpath(file_path, root_dir)
                
                zip_file.write(file_path, rel_path)
                print(f" + Packed: {rel_path}")

    print(f"\nSUCCESS: Created full source code ZIP archive at: {zip_path}")

if __name__ == "__main__":
    zip_project()
