import os
import sys
import glob
import zipfile

out_dir = os.path.join("dist")
os.makedirs(out_dir, exist_ok=True)
out_zip_file = os.path.join(out_dir, f"norobot_{sys.argv[1]}.zip")
if os.path.isfile(out_zip_file):
    ans = input(f"Overwrite file {out_zip_file} (y/yes)?\n")
    if ans in ('y', 'yes'):
        os.remove(out_zip_file)
    else:
        sys.exit(1)

with zipfile.ZipFile(out_zip_file, 'x', compression=zipfile.ZIP_DEFLATED) as myzip:
        #  ZipFile.write(filename, arcname=None, compress_type=None, compresslevel=None)
        # Write the file named filename to the archive, giving it the archive
        # name arcname (by default, this will be the same as filename, but
        # without a drive letter and with leading path separators removed)
        # relative paths given will have the same path in the archive even paths including ..
        # abspaths have the drive letter removed
        for gl in ["firefox/*.js", "firefox/*.html", "firefox/*.json",
                   "firefox/*.css", "firefox/ico/*.png"]:
            for fn in glob.iglob(gl):
                # fn is relative!!
                print("Added:", fn, end=' ')
                arch_fn = os.path.relpath(os.path.normpath(fn), start="firefox")
                print("as", arch_fn)
                myzip.write(fn, arch_fn)

